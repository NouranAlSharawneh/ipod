use std::sync::Mutex;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, RunEvent, WindowEvent,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_shell::{process::CommandChild, ShellExt};

const BRIDGE_PORT: u16 = 38421;

struct BridgeState {
    child: Mutex<Option<CommandChild>>,
}

#[tauri::command]
fn bridge_port() -> u16 {
    BRIDGE_PORT
}

fn toggle_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        if win.is_visible().unwrap_or(false) {
            let _ = win.hide();
        } else {
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}

fn toggle_pin(app: &AppHandle) -> bool {
    if let Some(win) = app.get_webview_window("main") {
        let now = !win.is_always_on_top().unwrap_or(false);
        let _ = win.set_always_on_top(now);
        return now;
    }
    false
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(BridgeState {
            child: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![bridge_port])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // Spawn the Express bridge as a sidecar.
            let sidecar = app
                .shell()
                .sidecar("ipod-bridge")
                .expect("failed to resolve ipod-bridge sidecar")
                .env("PORT", BRIDGE_PORT.to_string());
            let (mut rx, child) = sidecar.spawn().expect("failed to spawn ipod-bridge");
            let state = app.state::<BridgeState>();
            *state.child.lock().unwrap() = Some(child);

            // Drain stdout/stderr so the pipe doesn't fill up.
            tauri::async_runtime::spawn(async move {
                use tauri_plugin_shell::process::CommandEvent;
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            log::info!("[bridge] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Stderr(line) => {
                            log::warn!("[bridge] {}", String::from_utf8_lossy(&line));
                        }
                        _ => {}
                    }
                }
            });

            // Global hotkey: ⌘⇧I toggles always-on-top.
            let shortcut = Shortcut::new(
                Some(Modifiers::SUPER | Modifiers::SHIFT),
                Code::KeyI,
            );
            let app_handle = app.handle().clone();
            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(move |_app, sc, event| {
                        if sc == &shortcut && event.state() == ShortcutState::Pressed {
                            toggle_pin(&app_handle);
                        }
                    })
                    .build(),
            )?;
            app.global_shortcut().register(shortcut)?;

            // Menubar tray (since dock is hidden, this is the escape hatch).
            let show_hide = MenuItem::with_id(app, "toggle", "Show / Hide", true, None::<&str>)?;
            let pin = MenuItem::with_id(app, "pin", "Toggle pin on top", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit iPod", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_hide, &pin, &quit])?;
            let _tray = TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().cloned().unwrap())
                .icon_as_template(true)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "toggle" => toggle_window(app),
                    "pin" => {
                        toggle_pin(app);
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_window(tray.app_handle());
                    }
                })
                .build(app)?;

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // Hide instead of close — quitting goes through the tray.
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                if let Some(state) = app.try_state::<BridgeState>() {
                    if let Some(child) = state.child.lock().unwrap().take() {
                        let _ = child.kill();
                    }
                }
            }
        });
}
