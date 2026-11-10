# 2026 문인 동문회 행사 사이트

연희관 앞마당을 3D 디오라마로 만든 행사용 사이트입니다. 참석자는 폰으로 QR을 찍고 들어와 캐릭터를 만들고, 소식을 남기면 맵에서 말풍선으로 뜹니다.

| 화면 | 주소 | 쓰는 사람 |
|---|---|---|
| 폰 화면 | `/` | 참석자 |
| 큰 화면 (빔) | `/live.html` | 빔 노트북 |
| 운영진 화면 | `/admin.html` | 운영진 (공지, 지금 순서, 소식 관리) |
| 진행 장표 | `/slides/` | 사회자, 폰의 '장표' 탭 |

---

## 1. 처음 한 번만: DB 설정

1. [Supabase 대시보드](https://supabase.com/dashboard) → 프로젝트 `munin-2026` → 왼쪽 **SQL Editor** → **New query**
2. 이 저장소의 `supabase/setup.sql` 내용을 전부 붙여 넣습니다.
3. 맨 아래 줄 `'여기에-운영진-코드'` 를 운영진끼리 쓸 코드로 바꿉니다. (예시 코드 그대로면 운영진 화면이 열리지 않습니다.)
4. **Run** 을 누릅니다. `Success` 가 뜨면 끝입니다.

DB 설정 전에는 사이트가 '미리보기' 모드로 예시 캐릭터와 예시 소식을 보여 줍니다.

## 2. 처음 한 번만: 배포 (Cloudflare Workers)

1. [Cloudflare 대시보드](https://dash.cloudflare.com) → Workers & Pages → **Create** → GitHub 저장소 `munin-2026` 연결
2. 설정
   - Project name: `munin-2026` (저장소의 `wrangler.jsonc` 이름과 같아야 합니다)
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy` (기본값 그대로)
3. **Deploy**. 1~2분 뒤 `https://munin-2026.<계정이름>.workers.dev` 로 열립니다.

이후로는 `main` 에 올리면 자동으로 다시 배포됩니다.

## 3. 내용 바꾸기

| 바꿀 것 | 파일 |
|---|---|
| 식순, 1부 자리 안내, 네트워킹 분야, 뒤풀이, 후원자 명단 | `src/content.js` |
| 진행 장표 | `slides/index.html` |
| Supabase 주소·키 | `src/config.js` (publishable key 만. secret key 는 절대 넣지 않기) |

## 4. 행사 전 체크리스트

- [ ] 운영진 화면에서 '참석자까지 모두 지우기'로 테스트 데이터 정리
- [ ] 행사 전날 사이트 한 번 열기 (Supabase 무료 프로젝트는 7일 동안 안 쓰면 잠듭니다)
- [ ] 빔 노트북에서 `/live.html` 띄우고 뒤쪽 자리에서 QR이 찍히는지 확인
- [ ] 행사장 와이파이 확인 (폰은 LTE로도 됩니다)

## 구조

- `src/world.js` 연희관 앞마당 3D 장면 (정적인 물체는 재질별로 합쳐서 폰에서도 가볍게)
- `src/characters.js` 점토 피규어 캐릭터 (한 사람 = 한 덩어리)
- `src/engine.js` 장면, 카메라, 캐릭터 이동, 탭 처리
- `src/data.js` Supabase 연결 (DB 설정 전엔 미리보기 모드)
- `src/main.js` 폰 화면, `src/live.js` 큰 화면, `src/admin.js` 운영진 화면
- `supabase/setup.sql` DB 테이블·권한·함수

로컬에서 보기: `npm install` → `npm run dev`
