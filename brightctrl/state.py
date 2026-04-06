import threading

from .ddc import set_brightness


class AppState:
    def __init__(self):
        self.monitors: list = []
        self.slider_tags: dict = {}  # display_index -> slider tag
        self.value_tags: dict = {}  # display_index -> pct text tag
        self.sync_mode: bool = False
        self.syncing: bool = False
        self.loading: bool = False
        self.pending: dict = {}  # display_index -> threading.Timer

        # Cross-thread signalling flags (set by background threads, read in render loop)
        self._detect_ready: bool = False
        self._detect_result: tuple | None = None
        self._brightness_ready: bool = False

    def schedule_set(self, display_index, value, debounce=0.3):
        """Debounced brightness set — cancels any pending call for the same display."""
        if display_index in self.pending:
            self.pending[display_index].cancel()
        t = threading.Timer(debounce, self._apply, args=(display_index, value))
        self.pending[display_index] = t
        t.start()

    def _apply(self, display_index, value):
        set_brightness(display_index, value)
        self.pending.pop(display_index, None)

    def cancel_all(self):
        """Cancel all pending brightness updates (call on exit)."""
        for t in self.pending.values():
            t.cancel()
        self.pending.clear()
