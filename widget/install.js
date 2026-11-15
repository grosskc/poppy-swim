let fm
try {
  fm = FileManager.iCloud()
  fm.documentsDirectory()
} catch (e) {
  fm = FileManager.local()
}
const code = await new Request("https://grosskc.github.io/poppy-swim/widget/PoppySwim.js").loadString()
fm.writeString(fm.joinPath(fm.documentsDirectory(), "Poppy Swim.js"), code)
const a = new Alert()
a.title = "Poppy Swim installed"
a.message = "Now add a Scriptable widget to your Home Screen and pick Poppy Swim."
a.addAction("OK")
await a.presentAlert()
Script.complete()
