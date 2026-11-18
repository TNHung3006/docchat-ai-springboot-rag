package com.example.docchat;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;

import java.awt.Desktop;
import java.net.URI;

@SpringBootApplication
public class DocChatApplication {

    private final Environment env;

    public DocChatApplication(Environment env) {
        this.env = env;
    }

    public static void main(String[] args) {
        SpringApplication.run(DocChatApplication.class, args);
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        String port = env.getProperty("local.server.port");
        if (port == null) {
            return; // Đang chạy trong môi trường test (không mở cổng web thực tế)
        }
        String url = "http://localhost:" + port;
        System.out.println("\n=======================================================");
        System.out.println("  DOCCHAT AI DA KHOI DONG THANH CONG!");
        System.out.println("  Mo trinh duyet va truy cap: " + url);
        System.out.println("=======================================================\n");

        try {
            if (Desktop.isDesktopSupported() && Desktop.getDesktop().isSupported(Desktop.Action.BROWSE)) {
                Desktop.getDesktop().browse(new URI(url));
            } else if (System.getProperty("os.name", "").toLowerCase().contains("win")) {
                new ProcessBuilder("cmd", "/c", "start", url).start();
            }
        } catch (Exception ignored) {
            // Bỏ qua nếu môi trường không hỗ trợ mở trình duyệt tự động
        }
    }
}
