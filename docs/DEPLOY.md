# 배포 가이드 (Vercel)

혼밥 지도는 Next.js 앱이라 **Vercel**(무료 Hobby 요금제)에 올리는 게 가장 간단하다.
GitHub `main` 에 올릴 때마다 자동으로 다시 배포된다.

## 1. Vercel 프로젝트 만들기

1. https://vercel.com 에 **GitHub 계정으로 가입/로그인**.
2. **Add New… → Project** → `sebeen13-web/honbap01` 저장소 **Import**.
   (목록에 없으면 "Adjust GitHub App Permissions" 에서 이 저장소 접근을 허용)
3. Framework Preset 은 자동으로 **Next.js**. 빌드 설정은 그대로 둔다.
4. **Environment Variables** 에 아래 4개를 넣는다 (값은 `.env.local` 과 같음):

   | 이름 | 값 |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://vquelkukpoevtceblrbm.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable 키 (`sb_publishable_...`) |
   | `NEXT_PUBLIC_KAKAO_MAP_APP_KEY` | 카카오 JavaScript 키 |
   | `NEXT_PUBLIC_SITE_URL` | 배포 주소 (처음엔 비워 두고, 주소가 나오면 넣고 **Redeploy**) |

5. **Deploy**. 1~2분 뒤 `https://honbap01-xxxx.vercel.app` 같은 주소가 나온다.
   Settings → Domains 에서 `honbap01.vercel.app` 처럼 짧은 이름으로 바꿀 수 있다(비어 있으면).

> service_role(secret) 키, 카카오 Client Secret 은 **Vercel 에 넣지 않는다.** 앱이 쓰지 않는다.

## 2. 배포 주소를 각 서비스에 알려 주기

배포 주소를 `https://내주소.vercel.app` 이라고 할 때:

### Supabase (로그인 후 돌아올 주소)
대시보드 → **Authentication → URL Configuration**
- **Site URL**: `https://내주소.vercel.app`
- **Redirect URLs** 에 추가: `https://내주소.vercel.app/**` (기존 `http://localhost:3000/**` 은 남겨 둔다)

### 카카오 개발자 콘솔 (지도·장소 검색)
내 애플리케이션 → **앱 설정 → 플랫폼 → Web → 사이트 도메인** 에 `https://내주소.vercel.app` 추가
(카카오 로그인 Redirect URI 는 Supabase 주소라 바꾸지 않는다.)

### Vercel
`NEXT_PUBLIC_SITE_URL` = `https://내주소.vercel.app` 넣고 **Deployments → … → Redeploy** (스티커 QR 주소).

## 3. 확인

- 휴대폰으로 배포 주소 접속 → "내 위치로 찾기" (https 라 휴대폰에서도 위치가 된다)
- 지도에 식당 마커, 상세 → 길찾기(출발 = 내 위치)
- 로그인(카카오/이메일) → 돌아왔을 때 로그인 상태
- 관리자 `/admin/login`

## 4. 그 뒤

- 코드를 고쳐 `main` 에 올리면 Vercel 이 자동으로 다시 배포한다.
- DB 변경(새 마이그레이션)은 Vercel 과 따로, Supabase 에 적용한다.
- 90일 지난 원탭 확인 정리: `select public.purge_old_confirmations();` (SQL Editor, 한 달에 한 번 정도)
