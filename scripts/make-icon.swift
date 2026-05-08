import AppKit
import Foundation

let size: CGFloat = 1024
let outURL = URL(fileURLWithPath: CommandLine.arguments.dropFirst().first ?? "/tmp/icon.png")

let img = NSImage(size: NSSize(width: size, height: size))
img.lockFocus()

// Black rounded square background (macOS-style app icon corner radius ≈ 22.5%).
let bgRect = NSRect(x: 0, y: 0, width: size, height: size)
let radius: CGFloat = size * 0.225
let path = NSBezierPath(roundedRect: bgRect, xRadius: radius, yRadius: radius)
NSColor.black.setFill()
path.fill()

// Centered emoji glyph.
let glyph = "🎵"
let font = NSFont(name: "Apple Color Emoji", size: size * 0.62) ?? NSFont.systemFont(ofSize: size * 0.62)
let attrs: [NSAttributedString.Key: Any] = [.font: font]
let s = NSAttributedString(string: glyph, attributes: attrs)
let textSize = s.size()
let pt = NSPoint(x: (size - textSize.width) / 2, y: (size - textSize.height) / 2)
s.draw(at: pt)

img.unlockFocus()

guard let tiff = img.tiffRepresentation,
      let rep = NSBitmapImageRep(data: tiff),
      let png = rep.representation(using: .png, properties: [:]) else {
    fputs("failed to encode PNG\n", stderr)
    exit(1)
}
try png.write(to: outURL)
print("wrote \(outURL.path)")
