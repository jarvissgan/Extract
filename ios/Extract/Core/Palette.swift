import SwiftUI

/// The web app's Mantine colour names ("pink", "orange.6") as SwiftUI colours.
enum Palette {
    static func color(_ name: String?) -> Color {
        let key = (name ?? "gray").split(separator: ".").first.map(String.init) ?? "gray"
        switch key {
        case "dark": return Color(hex: 0x25262B)
        case "gray": return Color(hex: 0x868E96)
        case "red": return Color(hex: 0xFA5252)
        case "pink": return Color(hex: 0xE64980)
        case "grape": return Color(hex: 0xBE4BDB)
        case "violet": return Color(hex: 0x7950F2)
        case "indigo": return Color(hex: 0x4C6EF5)
        case "blue": return Color(hex: 0x228BE6)
        case "cyan": return Color(hex: 0x15AABF)
        case "teal": return Color(hex: 0x12B886)
        case "green": return Color(hex: 0x40C057)
        case "lime": return Color(hex: 0x82C91E)
        case "yellow": return Color(hex: 0xFAB005)
        case "orange": return Color(hex: 0xFD7E14)
        default: return Color(hex: 0x868E96)
        }
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}

/// Shows an error from an async action as an alert.
struct ErrorAlert: ViewModifier {
    @Binding var message: String?

    func body(content: Content) -> some View {
        content.alert("Something went wrong", isPresented: Binding(
            get: { message != nil },
            set: { if !$0 { message = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(message ?? "")
        }
    }
}

extension View {
    func errorAlert(_ message: Binding<String?>) -> some View { modifier(ErrorAlert(message: message)) }
}
