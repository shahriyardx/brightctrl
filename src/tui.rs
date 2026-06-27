//! ratatui terminal UI. Mirrors the original Ink layout: header, monitor cards
//! with brightness bars, sync/precise pills, help page.

use std::cell::RefCell;
use std::collections::HashSet;
use std::io;
use std::sync::mpsc::{self, Receiver};
use std::time::{Duration, Instant};

use anyhow::Result;
use ratatui::crossterm::event::{
    self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode, KeyEventKind, MouseButton,
    MouseEventKind,
};
use ratatui::crossterm::execute;
use ratatui::layout::{Alignment, Constraint, Layout, Rect};
use ratatui::style::{Color, Style, Stylize};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Padding, Paragraph};
use ratatui::{DefaultTerminal, Frame};

use crate::config::Config;
use crate::ddc::{self, Monitor};

const SPINNER: [&str; 10] = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const HEADER_BG: Color = Color::Rgb(21, 25, 37);
const WRITE_DEBOUNCE: Duration = Duration::from_millis(120);
const WRITE_THROTTLE: Duration = Duration::from_millis(100);

/// Clickable region of one monitor card, recorded each render for mouse hit-testing.
#[derive(Clone, Copy)]
struct CardHit {
    index: usize,
    card: Rect,
    bar: Rect,
}

/// Clickable header toggle, recorded each render.
#[derive(Clone, Copy)]
enum Control {
    Sync,
    Precise,
}

#[derive(PartialEq)]
enum Page {
    Home,
    Help,
}

struct App {
    config: Config,
    monitors: Vec<Monitor>,
    selected: usize,
    sync_mode: bool,
    precise_mode: bool,
    status: String,
    error: Option<String>,
    loading: bool,
    page: Page,
    input_mode: bool,
    edit_buffer: String,
    spinner: usize,
    should_quit: bool,
    dirty: HashSet<usize>,
    last_input: Instant,
    last_flush: Instant,
    detect_rx: Option<Receiver<std::result::Result<Vec<Monitor>, String>>>,
    /// Card/bar screen rects from the last render, for mouse hit-testing.
    hits: RefCell<Vec<CardHit>>,
    /// Header toggle rects (Sync/Precise) from the last render.
    controls: RefCell<Vec<(Control, Rect)>>,
}

impl App {
    fn new() -> Self {
        let config = Config::load();
        Self {
            sync_mode: config.sync_mode,
            precise_mode: config.precise_mode,
            config,
            monitors: Vec::new(),
            selected: 0,
            status: "Detecting monitors...".to_string(),
            error: None,
            loading: true,
            page: Page::Home,
            input_mode: false,
            edit_buffer: String::new(),
            spinner: 0,
            should_quit: false,
            dirty: HashSet::new(),
            last_input: Instant::now(),
            last_flush: Instant::now(),
            detect_rx: None,
            hits: RefCell::new(Vec::new()),
            controls: RefCell::new(Vec::new()),
        }
    }

    fn step(&self) -> i32 {
        if self.precise_mode {
            1
        } else {
            5
        }
    }

    fn toggle_sync(&mut self) {
        self.sync_mode = !self.sync_mode;
        self.config.sync_mode = self.sync_mode;
        self.config.save();
    }

    fn toggle_precise(&mut self) {
        self.precise_mode = !self.precise_mode;
        self.config.precise_mode = self.precise_mode;
        self.config.save();
    }

    /// Kick off a background detect (shows the spinner until it completes).
    fn spawn_detect(&mut self) {
        self.loading = true;
        self.status = "Detecting monitors...".to_string();
        self.error = None;
        let (tx, rx) = mpsc::channel();
        std::thread::spawn(move || {
            let _ = tx.send(ddc::detect().map_err(|e| e.to_string()));
        });
        self.detect_rx = Some(rx);
    }

    fn poll_detect(&mut self) {
        let received = match &self.detect_rx {
            Some(rx) => rx.try_recv().ok(),
            None => None,
        };
        let Some(result) = received else { return };
        self.detect_rx = None;
        self.loading = false;
        match result {
            Ok(monitors) if monitors.is_empty() => {
                self.error = Some("No DDC/CI monitors detected".to_string());
                self.status = "No monitors found".to_string();
            }
            Ok(monitors) => {
                if self.selected >= monitors.len() {
                    self.selected = monitors.len().saturating_sub(1);
                }
                self.status = format!("{} monitor(s) — DDC/CI", monitors.len());
                self.monitors = monitors;
            }
            Err(e) => {
                self.error = Some(e);
                self.status = "backend error".to_string();
            }
        }
    }

    fn tick(&mut self) {
        if self.loading {
            self.spinner = (self.spinner + 1) % SPINNER.len();
        }
        self.poll_detect();
        // Flush when input pauses, or on a throttle so a mouse drag updates
        // the monitor live instead of only after the drag ends.
        let idle = self.last_input.elapsed() >= WRITE_DEBOUNCE;
        let throttled = self.last_flush.elapsed() >= WRITE_THROTTLE;
        if !self.dirty.is_empty() && (idle || throttled) {
            for i in std::mem::take(&mut self.dirty) {
                if let Some(m) = self.monitors.get_mut(i) {
                    let _ = m.flush();
                }
            }
            self.last_flush = Instant::now();
        }
    }

    fn flush_all(&mut self) {
        for i in std::mem::take(&mut self.dirty) {
            if let Some(m) = self.monitors.get_mut(i) {
                let _ = m.flush();
            }
        }
    }

    fn adjust(&mut self, delta: i32) {
        if self.monitors.is_empty() {
            return;
        }
        let sel = self.selected;
        for i in 0..self.monitors.len() {
            if !self.sync_mode && i != sel {
                continue;
            }
            let m = &mut self.monitors[i];
            m.brightness = (m.brightness as i32 + delta).clamp(0, 100) as u16;
            self.dirty.insert(i);
        }
        self.last_input = Instant::now();
    }

    fn set_exact(&mut self, value: u16) {
        if self.monitors.is_empty() {
            return;
        }
        let v = value.min(100);
        let sel = self.selected;
        for i in 0..self.monitors.len() {
            if !self.sync_mode && i != sel {
                continue;
            }
            self.monitors[i].brightness = v;
            self.dirty.insert(i);
        }
        self.last_input = Instant::now();
    }

    /// Set one monitor (respecting sync mode) and make it the selection.
    fn set_monitor(&mut self, index: usize, value: u16) {
        if index >= self.monitors.len() {
            return;
        }
        self.selected = index;
        self.set_exact(value);
    }

    fn adjust_monitor(&mut self, index: usize, delta: i32) {
        if index >= self.monitors.len() {
            return;
        }
        self.selected = index;
        self.adjust(delta);
    }

    fn handle_mouse(&mut self, kind: MouseEventKind, col: u16, row: u16) {
        if self.page != Page::Home {
            return;
        }
        let hits = self.hits.borrow().clone();
        match kind {
            MouseEventKind::Down(MouseButton::Left)
            | MouseEventKind::Drag(MouseButton::Left) => {
                // Dragging on a bar sets the value at the cursor; a plain
                // click that's already started a drag keeps tracking that bar.
                for h in &hits {
                    if point_in(h.bar, col, row) {
                        self.set_monitor(h.index, value_at(h.bar, col));
                        return;
                    }
                }
                if matches!(kind, MouseEventKind::Down(MouseButton::Left)) {
                    let controls = self.controls.borrow().clone();
                    for (ctrl, rect) in controls {
                        if point_in(rect, col, row) {
                            match ctrl {
                                Control::Sync => self.toggle_sync(),
                                Control::Precise => self.toggle_precise(),
                            }
                            return;
                        }
                    }
                    for h in &hits {
                        if point_in(h.card, col, row) {
                            self.selected = h.index;
                            return;
                        }
                    }
                }
            }
            MouseEventKind::ScrollUp => {
                for h in &hits {
                    if point_in(h.card, col, row) {
                        self.adjust_monitor(h.index, self.step());
                        return;
                    }
                }
            }
            MouseEventKind::ScrollDown => {
                for h in &hits {
                    if point_in(h.card, col, row) {
                        self.adjust_monitor(h.index, -self.step());
                        return;
                    }
                }
            }
            _ => {}
        }
    }

    fn handle_key(&mut self, code: KeyCode) {
        match self.page {
            Page::Help => self.handle_help_key(code),
            Page::Home if self.input_mode => self.handle_input_key(code),
            Page::Home => self.handle_home_key(code),
        }
    }

    fn handle_help_key(&mut self, code: KeyCode) {
        match code {
            KeyCode::Char('q') => self.should_quit = true,
            KeyCode::Char('?') | KeyCode::Esc | KeyCode::Enter => self.page = Page::Home,
            _ => {}
        }
    }

    fn handle_input_key(&mut self, code: KeyCode) {
        match code {
            KeyCode::Enter => {
                if let Ok(v) = self.edit_buffer.parse::<u16>() {
                    self.set_exact(v);
                }
                self.input_mode = false;
                self.edit_buffer.clear();
            }
            KeyCode::Esc | KeyCode::Char('/') => {
                self.input_mode = false;
                self.edit_buffer.clear();
            }
            KeyCode::Backspace => {
                self.edit_buffer.pop();
            }
            KeyCode::Char(c) if c.is_ascii_digit() && self.edit_buffer.len() < 3 => {
                self.edit_buffer.push(c);
            }
            _ => {}
        }
    }

    fn handle_home_key(&mut self, code: KeyCode) {
        let step = self.step();
        let last = self.monitors.len().saturating_sub(1);
        match code {
            KeyCode::Char('q') => self.should_quit = true,
            KeyCode::Char('?') => self.page = Page::Help,
            KeyCode::Char('/') => {
                if !self.monitors.is_empty() {
                    self.input_mode = true;
                    self.edit_buffer.clear();
                }
            }
            KeyCode::Char(c @ '1'..='9') => {
                let n = (c as usize - '0' as usize) - 1;
                self.selected = n.min(last);
            }
            KeyCode::Up | KeyCode::Char('k') => self.selected = self.selected.saturating_sub(1),
            KeyCode::Down | KeyCode::Char('j') => self.selected = (self.selected + 1).min(last),
            KeyCode::Left | KeyCode::Char('h') => self.adjust(-step),
            KeyCode::Right | KeyCode::Char('l') => self.adjust(step),
            KeyCode::Char('p') => self.toggle_precise(),
            KeyCode::Char('s') => self.toggle_sync(),
            KeyCode::Char('r') => self.spawn_detect(),
            KeyCode::Char('m') => self.set_exact(0),
            _ => {}
        }
    }
}

/// True if a screen cell (col, row) falls inside `rect`.
fn point_in(rect: Rect, col: u16, row: u16) -> bool {
    col >= rect.x && col < rect.x + rect.width && row >= rect.y && row < rect.y + rect.height
}

/// Map a cursor column over a bar rect to a 0-100 brightness value.
fn value_at(bar: Rect, col: u16) -> u16 {
    let w = bar.width.max(1);
    let rel = col.saturating_sub(bar.x).min(w.saturating_sub(1)) as u32;
    let denom = (w.saturating_sub(1)).max(1) as u32;
    ((rel * 100 + denom / 2) / denom) as u16
}

pub fn run() -> Result<()> {
    let mut terminal = ratatui::init();
    let _ = execute!(io::stdout(), EnableMouseCapture);
    let result = run_app(&mut terminal);
    let _ = execute!(io::stdout(), DisableMouseCapture);
    ratatui::restore();
    result
}

fn run_app(terminal: &mut DefaultTerminal) -> Result<()> {
    let mut app = App::new();
    // Load monitors from cache if present — no auto-detect, the user refreshes
    // with `r`. Only the first launch (empty cache) detects automatically.
    let mut have_cache = false;
    if let Some(cached) = crate::config::read_monitor_cache() {
        if !cached.is_empty() {
            app.selected = app.selected.min(cached.len() - 1);
            app.monitors = cached;
            app.status = "Ready".to_string();
            app.loading = false;
            have_cache = true;
        }
    }
    if !have_cache {
        app.spawn_detect();
    }

    while !app.should_quit {
        terminal.draw(|f| ui(f, &app))?;
        if event::poll(Duration::from_millis(100))? {
            match event::read()? {
                Event::Key(key) if key.kind == KeyEventKind::Press => app.handle_key(key.code),
                Event::Mouse(m) => app.handle_mouse(m.kind, m.column, m.row),
                _ => {}
            }
        }
        app.tick();
    }

    app.flush_all();
    Ok(())
}

fn ui(f: &mut Frame, app: &App) {
    app.hits.borrow_mut().clear();
    app.controls.borrow_mut().clear();
    let area = f.area();
    let outer = Block::bordered().border_style(Style::new().fg(Color::Cyan));
    let inner = outer.inner(area);
    f.render_widget(outer, area);

    let chunks = Layout::vertical([Constraint::Length(5), Constraint::Min(0)]).split(inner);
    render_header(f, chunks[0]);
    match app.page {
        Page::Home => render_home(f, chunks[1], app),
        Page::Help => render_help(f, chunks[1]),
    }
}

fn render_header(f: &mut Frame, area: Rect) {
    let block = Block::default()
        .style(Style::new().bg(HEADER_BG))
        .padding(Padding::new(2, 1, 1, 0));
    let inner = block.inner(area);
    f.render_widget(block, area);

    // Left text and the right-aligned help hint share the same area; their
    // content never overlaps, so the hint sits flush against the right edge.
    let left = Paragraph::new(vec![
        Line::from(Span::styled(
            "brightctrl",
            Style::new().fg(Color::Green).bold(),
        )),
        Line::from(Span::styled(
            "External monitor brightness control",
            Style::new().fg(Color::White),
        )),
        Line::from(Span::styled(
            format!("v{}", env!("CARGO_PKG_VERSION")),
            Style::new().fg(Color::Gray),
        )),
    ]);
    f.render_widget(left, inner);

    let right = Paragraph::new(Line::from(vec![
        Span::styled("Press ", Style::new().fg(Color::Gray)),
        Span::styled("?", Style::new().fg(Color::Yellow).bold()),
        Span::styled(" for help", Style::new().fg(Color::Gray)),
    ]))
    .alignment(Alignment::Right);
    f.render_widget(right, inner);
}

fn render_home(f: &mut Frame, area: Rect, app: &App) {
    let block = Block::default().padding(Padding::horizontal(2));
    let area = block.inner(area);
    f.render_widget(block, area);

    let rows = Layout::vertical([
        Constraint::Length(1), // gap above the MONITORS title
        Constraint::Length(1), // title
        Constraint::Length(1), // gap below the title
        Constraint::Min(0),    // monitor cards
    ])
    .split(area);
    render_title(f, rows[1], app);
    let body = rows[3];

    if app.monitors.is_empty() {
        if app.loading {
            let p = Paragraph::new(Line::from(vec![
                Span::styled(format!("{} ", SPINNER[app.spinner]), Style::new().fg(Color::Cyan)),
                Span::styled(format!("{}...", app.status), Style::new().fg(Color::Gray)),
            ]))
            .block(Block::bordered().border_style(Style::new().fg(Color::Rgb(41, 49, 58))));
            f.render_widget(p, Rect::new(body.x, body.y, body.width, 3));
        } else if let Some(err) = &app.error {
            render_error(f, body, err);
        }
        return;
    }

    // Sync mode collapses the list into one card showing the average.
    if app.sync_mode {
        render_synced_card(f, Rect::new(body.x, body.y, body.width, 4), app);
        return;
    }

    let mut y = body.y;
    for (i, m) in app.monitors.iter().enumerate() {
        if y + 4 > body.bottom() {
            break;
        }
        render_card(f, Rect::new(body.x, y, body.width, 4), m, i, app);
        y += 4;
    }
}

fn render_title(f: &mut Frame, area: Rect, app: &App) {
    let cols = Layout::horizontal([Constraint::Min(0), Constraint::Length(26)]).split(area);

    let mut left = Vec::new();
    if app.loading {
        left.push(Span::styled(
            format!("{} ", SPINNER[app.spinner]),
            Style::new().fg(Color::Cyan),
        ));
    }
    left.push(Span::styled("MONITORS", Style::new().fg(Color::Cyan).bold()));
    f.render_widget(Paragraph::new(Line::from(left)), cols[0]);

    let pill = |label: &str, key: &str, on: bool| -> Vec<Span<'static>> {
        let bg = if on { Color::Green } else { Color::Gray };
        vec![
            Span::styled(format!(" {label}"), Style::new().bg(bg).fg(Color::Black)),
            Span::styled(format!(" ({key}) "), Style::new().bg(bg).fg(Color::Black)),
        ]
    };
    let sync = pill("Sync", "s", app.sync_mode);
    let precise = pill("Precise", "p", app.precise_mode);
    let sync_w: u16 = sync.iter().map(|s| s.content.chars().count() as u16).sum();
    let precise_w: u16 = precise.iter().map(|s| s.content.chars().count() as u16).sum();
    let total = sync_w + 1 + precise_w;

    let mut pills = sync;
    pills.push(Span::raw(" "));
    pills.extend(precise);
    f.render_widget(
        Paragraph::new(Line::from(pills)).alignment(Alignment::Right),
        cols[1],
    );

    // Record the on-screen rects so the pills are clickable. Right-aligned, so
    // they end at the column's right edge.
    let start = cols[1].x + cols[1].width.saturating_sub(total);
    let sync_rect = Rect::new(start, cols[1].y, sync_w, 1);
    let precise_rect = Rect::new(start + sync_w + 1, cols[1].y, precise_w, 1);
    let mut controls = app.controls.borrow_mut();
    controls.push((Control::Sync, sync_rect));
    controls.push((Control::Precise, precise_rect));
}

fn render_card(f: &mut Frame, area: Rect, m: &Monitor, i: usize, app: &App) {
    let accent = if app.selected == i || app.sync_mode {
        Color::Cyan
    } else {
        Color::Gray
    };
    let block = Block::bordered()
        .border_style(Style::new().fg(accent))
        .padding(Padding::horizontal(1));
    let inner = block.inner(area);
    f.render_widget(block, area);

    let cols = Layout::horizontal([Constraint::Length(30), Constraint::Min(0)]).split(inner);

    // Left: number + name + (alias), then bus.
    let mut name_line = vec![
        Span::styled(format!("{:<3} ", m.index), Style::new().fg(accent).bold()),
        Span::styled(m.name.clone(), Style::new().fg(accent).bold()),
    ];
    if let Some(alias) = app.config.alias_of(&m.id) {
        name_line.push(Span::styled(
            format!(" ({alias})"),
            Style::new().fg(Color::DarkGray),
        ));
    }
    let left = Paragraph::new(vec![
        Line::from(name_line),
        Line::from(Span::styled(
            format!("    {}", m.bus),
            Style::new().fg(Color::Gray),
        )),
    ]);
    f.render_widget(left, cols[0]);

    // Right: BRIGHTNESS label + value, then the bar.
    let rw = cols[1].width as usize;
    let editing = app.input_mode && app.selected == i;
    let value = if editing {
        format!("{}|", app.edit_buffer)
    } else {
        format!("{}%", m.brightness)
    };
    let label = "BRIGHTNESS";
    let pad = rw.saturating_sub(label.len() + value.chars().count());
    let top = Line::from(vec![
        Span::styled(label, Style::new().fg(accent)),
        Span::raw(" ".repeat(pad)),
        Span::styled(value, Style::new().fg(accent).bold()),
    ]);

    let filled = m.brightness as usize * rw / 100;
    let empty = rw.saturating_sub(filled);
    let bar = Line::from(vec![
        Span::styled("▰".repeat(filled), Style::new().fg(accent)),
        Span::styled("▱".repeat(empty), Style::new().fg(Color::DarkGray)),
    ]);
    f.render_widget(Paragraph::new(vec![top, bar]), cols[1]);

    // Record clickable regions: the whole card (select/scroll) and the bar
    // row (drag to set). The bar is the second line of the right column.
    let bar_rect = Rect::new(cols[1].x, cols[1].y + 1, cols[1].width, 1);
    app.hits.borrow_mut().push(CardHit {
        index: i,
        card: area,
        bar: bar_rect,
    });
}

/// One card representing all monitors at once (sync mode), showing the average.
fn render_synced_card(f: &mut Frame, area: Rect, app: &App) {
    let accent = Color::Cyan;
    let n = app.monitors.len();
    let avg = if n == 0 {
        0
    } else {
        (app.monitors.iter().map(|m| m.brightness as u32).sum::<u32>() / n as u32) as u16
    };

    let block = Block::bordered()
        .border_style(Style::new().fg(accent))
        .padding(Padding::horizontal(1));
    let inner = block.inner(area);
    f.render_widget(block, area);

    let cols = Layout::horizontal([Constraint::Length(30), Constraint::Min(0)]).split(inner);

    let left = Paragraph::new(vec![
        Line::from(Span::styled("All Monitors", Style::new().fg(accent).bold())),
        Line::from(Span::styled(
            format!("{n} synced"),
            Style::new().fg(Color::Gray),
        )),
    ]);
    f.render_widget(left, cols[0]);

    let rw = cols[1].width as usize;
    let value = if app.input_mode {
        format!("{}|", app.edit_buffer)
    } else {
        format!("{avg}%")
    };
    let label = "BRIGHTNESS";
    let pad = rw.saturating_sub(label.len() + value.chars().count());
    let top = Line::from(vec![
        Span::styled(label, Style::new().fg(accent)),
        Span::raw(" ".repeat(pad)),
        Span::styled(value, Style::new().fg(accent).bold()),
    ]);

    let filled = avg as usize * rw / 100;
    let empty = rw.saturating_sub(filled);
    let bar = Line::from(vec![
        Span::styled("▰".repeat(filled), Style::new().fg(accent)),
        Span::styled("▱".repeat(empty), Style::new().fg(Color::DarkGray)),
    ]);
    f.render_widget(Paragraph::new(vec![top, bar]), cols[1]);

    // Index 0 is fine: in sync mode set/adjust apply to every monitor.
    let bar_rect = Rect::new(cols[1].x, cols[1].y + 1, cols[1].width, 1);
    app.hits.borrow_mut().push(CardHit {
        index: 0,
        card: area,
        bar: bar_rect,
    });
}

fn render_error(f: &mut Frame, area: Rect, err: &str) {
    let lines = vec![
        Line::from(Span::styled("Troubleshooting:", Style::new().fg(Color::Yellow))),
        Line::from(Span::styled(
            "  sudo modprobe i2c-dev",
            Style::new().fg(Color::Gray),
        )),
        Line::from(Span::styled(
            "  sudo usermod -aG i2c $USER   (then log out and back in)",
            Style::new().fg(Color::Gray),
        )),
        Line::from(Span::styled(
            "  echo i2c-dev | sudo tee /etc/modules-load.d/i2c.conf",
            Style::new().fg(Color::Gray),
        )),
    ];
    let p = Paragraph::new(Line::from(Span::styled(
        err.to_string(),
        Style::new().fg(Color::Red),
    )))
    .block(Block::bordered().border_style(Style::new().fg(Color::Red)));
    f.render_widget(p, Rect::new(area.x, area.y, area.width, 3));
    f.render_widget(
        Paragraph::new(lines),
        Rect::new(area.x, area.y + 4, area.width, 4),
    );
}

fn render_help(f: &mut Frame, area: Rect) {
    let block = Block::default().padding(Padding::new(2, 2, 1, 0));
    let inner = block.inner(area);
    f.render_widget(block, area);

    let row = |keys: &str, label: &str| -> Line<'static> {
        Line::from(vec![
            Span::styled(format!("{:<8}", keys), Style::new().fg(Color::Yellow)),
            Span::styled(label.to_string(), Style::new().fg(Color::Gray)),
        ])
    };

    let left = vec![
        row("↑ / k", "Select previous monitor"),
        row("↓ / j", "Select next monitor"),
        row("← / h", "Decrease brightness"),
        row("→ / l", "Increase brightness"),
        row("1 - 9", "Select monitor by number"),
        row("/", "Enter exact brightness (0-100)"),
        row("mouse", "Drag bar to set, scroll to adjust"),
    ];
    let right = vec![
        row("p", "Toggle precise mode (1% steps)"),
        row("s", "Sync all monitors"),
        row("m", "Set brightness to 0"),
        row("r", "Refresh monitor list"),
        row("?", "Return home"),
        row("q", "Quit"),
    ];

    // CONTROLS title, blank, two columns, blank, config footer.
    let rows = Layout::vertical([
        Constraint::Length(1),                          // CONTROLS
        Constraint::Length(1),                          // gap
        Constraint::Length(left.len().max(right.len()) as u16), // columns
        Constraint::Length(1),                          // gap
        Constraint::Length(1),                          // config
        Constraint::Min(0),
    ])
    .split(inner);

    f.render_widget(
        Paragraph::new(Line::from(Span::styled(
            "CONTROLS",
            Style::new().fg(Color::Cyan).bold(),
        ))),
        rows[0],
    );

    let cols = Layout::horizontal([Constraint::Length(42), Constraint::Min(0)]).split(rows[2]);
    f.render_widget(Paragraph::new(left), cols[0]);
    f.render_widget(Paragraph::new(right), cols[1]);

    f.render_widget(
        Paragraph::new(Line::from(vec![
            Span::styled("Config: ", Style::new().fg(Color::Gray)),
            Span::styled(
                crate::config::config_path().display().to_string(),
                Style::new().fg(Color::Cyan),
            ),
        ])),
        rows[4],
    );
}
