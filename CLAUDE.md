# 작업 안내 (Claude용)

2026 문인 동문회(연세대 문화인류학과) 행사 사이트. 운영자는 비개발자이며 채팅으로 요청한다.

- 스택: Vite + three.js + Supabase(JS). 배포는 Cloudflare Pages (`npm run build` → `dist`), `main` push 시 자동 배포.
- 쓰기는 모두 `supabase/setup.sql` 의 RPC로만 한다(테이블은 anon 읽기 전용). 스키마를 바꾸면 setup.sql 을 여러 번 실행해도 안전하게 유지하고, 운영자에게 SQL Editor에서 다시 실행하라고 안내한다.
- `src/config.js` 에는 publishable key 만 둔다. secret key 는 어디에도 넣지 않는다.
- 행사 내용(식순·자리·네트워킹·후원자)은 `src/content.js` 에만 둔다. 확정 전 내용은 `[확정 전]` 으로 표시하고 지어내지 않는다.
- 폰 성능: 정적 메시는 `world.js` 끝에서 재질별로 병합된다. 새 소품은 `put/rbox/ball/cyl` 로 추가하면 자동 병합된다. 캐릭터는 `characters.js` 에서 한 지오메트리로 합친다.
- 화면을 고친 뒤에는 `npm run build` 후 Playwright(swiftshader)로 390×844 폰 화면과 1280×720 큰 화면을 캡처해 확인한다.
