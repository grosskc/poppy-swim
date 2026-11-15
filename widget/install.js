// Install or update the Poppy Swim widget script, then add a Scriptable
// widget on your Home Screen and select "Poppy Swim".
const NAME = "Poppy Swim"
const SRC = "https://grosskc.github.io/poppy-swim/widget/PoppySwim.js"
const fm = FileManager.iCloud()
const path = fm.joinPath(fm.documentsDirectory(), NAME + ".js")
const req = new Request(SRC)
req.timeoutInterval = 20
const code = await req.loadString()
if (!code || code.indexOf("poppy-swim/widget.json") === -1) {
  const err = new Alert()
  err.title = "Couldn't install Poppy Swim"
  err.message = "Check your internet connection and try again."
  err.addAction("OK")
  await err.presentAlert()
  Script.complete()
} else {
  fm.writeString(path, code)
  const ok = new Alert()
  ok.title = "Poppy Swim is ready"
  ok.message = "On your Home Screen, long-press an empty area, tap +, choose Scriptable, pick a size, then tap the widget and select the Poppy Swim script."
  ok.addAction("OK")
  await ok.presentAlert()
  Script.complete()
}
