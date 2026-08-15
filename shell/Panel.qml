import QtQuick
import QtQuick.Layouts
import Quickshell.Io
import qs.Ui
import qs.Commons

// Bar widget for brightctrl: one slider per DDC/CI monitor, plus a sync mode
// that drives them together.
//
// Everything on the open path reads `brightctrl list --json --fast`, which is
// served from ~/.config/brightctrl/monitors.json and returns in about a
// millisecond. A full `detect()` walks every i2c bus with retries and takes
// ~10s, so it only ever runs off the explicit refresh (r), in the background.
//
// Writes go through `brightctrl set`, which resolves from the same cache and
// verifies the monitor's EDID id before touching the bus.
Panel {
  id: root
  moduleName: "brightctrl.brightness"
  ipcTarget: "brightctrl.brightness"

  // Absolute path or bare name of the CLI. Override in shell.json when the
  // binary lives somewhere the shell's PATH doesn't cover.
  readonly property string binary: root.setting("binary", "brightctrl")
  // Slider step. 5 matches the TUI's coarse mode; precise mode uses 1.
  readonly property int step: root.setting("step", 5)

  // [{ index, id, name, alias, brightness, bus }]
  property var monitors: []
  property bool sync: false
  property bool loading: false
  property bool refreshing: false
  property string error: ""

  // Values the user has dragged to but that haven't been flushed to hardware
  // yet, keyed by monitor id. Cleared as each write completes.
  property var pending: ({})
  // Ids still queued for a write, drained one process at a time.
  property var writeQueue: []

  // Keyboard cursor.
  property bool cursorActive: false
  property int selectedIndex: 0

  readonly property int displayBrightness: {
    if (monitors.length === 0) return 0
    var m = monitors[Math.max(0, Math.min(monitors.length - 1, selectedIndex))]
    return valueOf(m)
  }

  readonly property string icon: {
    if (monitors.length === 0) return "󰃟"
    var v = displayBrightness
    if (v >= 66) return "󰃠"
    if (v >= 33) return "󰃟"
    return "󰃞"
  }

  function label(m) {
    return (m.alias && m.alias.length > 0) ? m.alias : m.name
  }

  // Pending value wins over the cached one so a dragged slider doesn't snap
  // back while its write is still in flight.
  function valueOf(m) {
    var p = pending[m.id]
    return p === undefined ? m.brightness : p
  }

  onOpenedChanged: {
    if (opened) {
      cursorActive = false
      load()
    }
  }

  function load() {
    if (loadProc.running) return
    error = ""
    loading = true
    loadProc.command = [binary, "list", "--json", "--fast"]
    loadProc.running = true
  }

  // Full i2c rescan. Slow by nature, so it runs detached from the open path and
  // leaves the current sliders live while it works.
  function refresh() {
    if (refreshProc.running) return
    refreshing = true
    refreshProc.command = [binary, "list", "--json"]
    refreshProc.running = true
  }

  function applyList(text) {
    var parsed = []
    try {
      parsed = JSON.parse(String(text || "[]"))
    } catch (e) {
      error = "Could not read monitor list"
      return
    }
    monitors = parsed
    if (selectedIndex >= monitors.length) selectedIndex = Math.max(0, monitors.length - 1)
    error = ""
  }

  // Record a value locally and queue the hardware write. The debounce timer
  // collapses a drag into one write per monitor.
  function setValue(id, value) {
    var v = Math.max(0, Math.min(100, Math.round(value)))
    var next = Object.assign({}, pending)
    next[id] = v
    pending = next
    if (writeQueue.indexOf(id) === -1) writeQueue = writeQueue.concat([id])
    debounce.restart()
  }

  function setFromSlider(m, value) {
    if (sync) {
      for (var i = 0; i < monitors.length; i++) setValue(monitors[i].id, value)
    } else {
      setValue(m.id, value)
    }
  }

  function drainQueue() {
    if (writeProc.running || writeQueue.length === 0) return
    var id = writeQueue[0]
    var v = pending[id]
    if (v === undefined) {
      writeQueue = writeQueue.slice(1)
      drainQueue()
      return
    }
    writeProc.command = [binary, "set", id, String(v)]
    writeProc.running = true
  }

  // Fold the flushed value into the monitor list so the cached brightness and
  // the slider agree once the pending entry goes away.
  function commit(id) {
    var v = pending[id]
    if (v !== undefined) {
      var updated = monitors.map(function(m) {
        return m.id === id ? Object.assign({}, m, { brightness: v }) : m
      })
      monitors = updated
    }
    var next = Object.assign({}, pending)
    delete next[id]
    pending = next
    writeQueue = writeQueue.slice(1)
    Qt.callLater(root.drainQueue)
  }

  function nudge(delta) {
    if (monitors.length === 0) return
    var m = monitors[selectedIndex]
    if (!m) return
    setFromSlider(m, valueOf(m) + delta)
  }

  Timer {
    id: debounce
    interval: 100
    onTriggered: root.drainQueue()
  }

  Process {
    id: loadProc
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.applyList(text)
    }
    stderr: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var e = String(text || "").trim()
        if (e !== "") root.error = e
      }
    }
    onExited: function(exitCode) {
      root.loading = false
      if (exitCode !== 0 && root.error === "") root.error = "brightctrl failed"
    }
  }

  Process {
    id: refreshProc
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.applyList(text)
    }
    onExited: function(exitCode) {
      root.refreshing = false
      if (exitCode !== 0) root.error = "Detection failed"
    }
  }

  Process {
    id: writeProc
    stderr: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var e = String(text || "").trim()
        if (e !== "") root.error = e
      }
    }
    onExited: function(exitCode) {
      // command[2] is the monitor id this write targeted.
      var id = writeProc.command.length > 2 ? writeProc.command[2] : ""
      if (exitCode === 0) root.error = ""
      if (id !== "") root.commit(id)
    }
  }

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: root.icon

    onPressed: function(b) {
      if (root.opened) root.close()
      else root.open()
    }
  }

  KeyboardPanel {
    id: panel
    anchorItem: button
    owner: root
    bar: root.bar
    open: root.opened
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(360))
    contentHeight: panel.fittedContentHeight(column.implicitHeight)

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent

      onMoveRequested: function(dx, dy) {
        if (!root.cursorActive) {
          root.cursorActive = true
          if (dy !== 0) return
        }
        if (dy !== 0 && root.monitors.length > 0) {
          var next = root.selectedIndex + (dy > 0 ? 1 : -1)
          root.selectedIndex = Math.max(0, Math.min(root.monitors.length - 1, next))
        }
        if (dx !== 0) root.nudge(dx > 0 ? root.step : -root.step)
      }
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }
      onTextKey: function(t) {
        if (t === "r" || t === "R") root.refresh()
        else if (t === "s" || t === "S") root.sync = !root.sync
        else if (t === "m" || t === "M") root.nudge(-100)
      }

      Column {
        id: column
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        spacing: Style.space(12)

        // ---------- Header: title · sync toggle ----------
        Item {
          width: parent.width
          implicitHeight: Math.max(title.implicitHeight, syncToggle.implicitHeight)

          Column {
            id: title
            anchors.left: parent.left
            anchors.verticalCenter: parent.verticalCenter
            spacing: Style.space(2)

            Text {
              text: "Brightness"
              color: Color.foreground
              font.family: Style.font.family
              font.pixelSize: Style.font.body
              font.bold: true
            }

            Text {
              text: {
                if (root.error !== "") return root.error
                if (root.refreshing) return "Detecting monitors"
                if (root.loading) return "Loading"
                if (root.monitors.length === 0) return "No DDC/CI monitors"
                return root.monitors.length + (root.monitors.length === 1 ? " display" : " displays")
              }
              color: root.error !== "" ? Color.urgent : Color.foreground
              opacity: root.error !== "" ? 1.0 : 0.55
              font.family: Style.font.family
              font.pixelSize: Style.font.caption
            }
          }

          ToggleSwitch {
            id: syncToggle
            anchors.right: parent.right
            anchors.verticalCenter: parent.verticalCenter
            checked: root.sync
            foreground: Color.foreground
            onToggled: root.sync = !root.sync

            PanelToolTip {
              visible: syncToggle.containsMouse
              text: "Sync all displays"
            }
          }
        }

        PanelSeparator { width: parent.width }

        // ---------- One row per monitor ----------
        Repeater {
          model: root.monitors

          Column {
            required property var modelData
            required property int index

            width: column.width
            spacing: Style.space(4)

            Item {
              width: parent.width
              implicitHeight: nameText.implicitHeight

              Text {
                id: nameText
                anchors.left: parent.left
                anchors.verticalCenter: parent.verticalCenter
                text: root.label(modelData)
                color: Color.foreground
                opacity: (root.cursorActive && root.selectedIndex === index) ? 1.0 : 0.75
                font.family: Style.font.family
                font.pixelSize: Style.font.bodySmall
              }

              Text {
                anchors.right: parent.right
                anchors.verticalCenter: parent.verticalCenter
                text: root.valueOf(modelData) + "%"
                color: Color.foreground
                opacity: 0.55
                font.family: Style.font.family
                font.pixelSize: Style.font.bodySmall
              }
            }

            PanelSlider {
              width: parent.width
              bar: root.bar
              minimum: 0
              maximum: 100
              step: root.step
              integer: true
              value: root.valueOf(modelData)
              onMoved: function(v) { root.setFromSlider(modelData, v) }
              onReleased: function(v) { root.setFromSlider(modelData, v) }
            }
          }
        }

        // ---------- Footer ----------
        PanelSeparator {
          width: parent.width
          visible: root.monitors.length > 0
        }

        Text {
          width: parent.width
          visible: root.monitors.length > 0
          text: "s sync · r rescan · m off"
          color: Color.foreground
          opacity: 0.4
          font.family: Style.font.family
          font.pixelSize: Style.font.caption
        }
      }
    }
  }
}
