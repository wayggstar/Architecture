# Architect

> 최신 Minecraft Paper API 규격을 준수하는 플러그인 자동 생성 아키텍트 시스템입니다.  

## ✨ 핵심 기능

* **원천적 Deprecated API 금지:** Java 표준 라이브러리 및 최신 오가닉 Paper 스펙에 맞춰 구식 메서드나 패키지를 일절 배제한 안전한 코드를 작성합니다.
* **Modern Text API 도입:** 구식 `ChatColor` 대신 `net.kyori.adventure.text.Component` 및 `MiniMessage` 스펙을 완벽하게 주입합니다.
* **임포트 무결성 보장:** 패키지 누락 및 구버전 Bukkit과의 스케줄러/이벤트 충돌을 방지하는 포괄적인 아키텍처 규칙이 적용됩니다.
* **다국어(i18n) 시스템 분리:** 플러그인 내부 메시지를 하드코딩하지 않고 `ko_kr.yml` 및 `en_us.yml` 리소스로 분리하여 동적 로컬라이징을 지원합니다.
