# Vercel 배포 안내

기존 `dashboard/` Vite 앱을 그대로 배포합니다. 새 앱 생성이나 프레임워크 전환은 하지 않았습니다. 실제 배포·계정 설정·Secret 등록은 사용자가 진행합니다.

## 현재 구조와 빌드 설정

```text
저장소 루트/
├── .gitignore                 # 키·업무 원본·검사 결과 제외
└── dashboard/                 # Vercel Root Directory
    ├── src/                   # 기존 매출·행사 준비·날씨 화면
    ├── public/data/           # 검토한 가상 자료 6개만 공개
    ├── api/weather.js         # GET /api/weather 서버 함수
    ├── server/weather.js      # OpenWeather 호출·캐시·예제 전환
    ├── .env.example           # OPENWEATHER_API_KEY= (값 없음)
    ├── .gitignore / .vercelignore
    ├── vite.config.js / vercel.json
    └── package.json / package-lock.json
```

| Vercel 항목 | 값 |
| --- | --- |
| Framework Preset | Vite |
| Root Directory | `dashboard` |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js | `24.x` |
| Development Command | `npm run dev` |
| 서버 환경변수 | `OPENWEATHER_API_KEY` (Secret) |

`dist`만 업로드하면 날씨 함수가 빠집니다. 소스의 `api/`, `server/`, `public/`와 설정 파일을 함께 올립니다. `vercel.json`은 `/api/`를 SPA 재작성에서 제외하고 예제 JSON을 함수에 포함합니다. 앱 폴더 밖의 파일은 필요하지 않습니다.

## 업로드 → Import → Secret → Deploy

1. **업로드:** 연결된 GitHub 저장소 `hanbbbbb-code/ssg_operating_tool`의 `main` 브랜치를 사용합니다. 배포 대상은 `dashboard/`입니다. 별도 전달용 `results/vercel-upload/dashboard/`와 ZIP도 같은 기존 앱의 파일 목록 기반 복사본입니다. 압축본으로 새 저장소에 올릴 경우에도 `dashboard/` 폴더 구조와 숨김 파일을 유지하세요. 저장소 전체를 Finder로 무작정 올리지 마세요. `.gitignore`는 수동 웹 업로드를 막지 않습니다.
2. **Import:** Vercel에서 사용할 계정·팀을 확인하고 Add New → Project → Import Git Repository에서 위 저장소를 선택합니다. GitHub 권한은 필요한 저장소로 제한합니다. 위 표의 빌드 설정을 확인합니다. 기존 Vercel 프로젝트에 이 저장소가 이미 연결돼 있으면 새 Import 대신 해당 프로젝트의 Root Directory·설정을 확인합니다. 이 경우 main 푸시가 자동 배포를 시작할 수 있습니다.
3. **Secret:** Environment Variables에서 이름 `OPENWEATHER_API_KEY`, 유형 **Secret**으로 등록합니다. 값은 본인 OpenWeather 계정에서 직접 입력하고 Production을 선택합니다. Preview가 필요하면 해당 환경에도 직접 설정하고 팀의 환경별 키 정책을 따릅니다. UI가 이전 버전이면 Sensitive 항목을 사용합니다. `VITE_` 접두사를 붙이지 않습니다. 미설정 상태로도 배포 가능하며 화면은 예제로 표시됩니다. 환경변수를 나중에 바꾸면 새 배포 또는 Redeploy가 필요합니다.
4. **Deploy:** 배포 전에 아래 계정·요금·접근 범위를 확인한 뒤 Deploy를 누릅니다. 완료 후 빌드 로그, Functions의 `/api/weather`, 실제 배포 URL을 확인합니다.

확인할 사항:

- Vercel 프로젝트 소유 계정·팀, 해당 용도에 맞는 요금제, 함수·대역폭 한도와 지출 설정.
- OpenWeather 현재 날씨 및 5일/3시간 예보 사용 권한, 호출 한도·과금 조건·키 활성 상태.
- Production/Preview의 Deployment Protection과 실제 접근 대상. 앱 자체에는 로그인·권한 분리가 없고 공개된 `/data/*`는 다운로드할 수 있습니다. 실제 점포·고객·매출 자료로 교체하지 마세요.
- 사용자 메모·개인 점검은 해당 브라우저의 localStorage에만 저장되며 팀 공유·서버 백업이 없습니다.

## 날씨 연결과 키 경계

브라우저 → 키 없는 `/api/weather` → 서버 `process.env.OPENWEATHER_API_KEY` → OpenWeather 현재 날씨·5일/3시간 예보 순서입니다. 서울 중구 참고 좌표이며 예제A점의 실제 위치가 아닙니다. 응답은 필요한 날씨 필드만 반환하며 외부 요청 URL·키·오류 원문을 반환하거나 로그에 쓰지 않습니다. 요청 제한은 5초, 성공 캐시는 10분이며 서버 인스턴스마다 별도입니다.

키 미설정·인증 실패·한도 초과·네트워크·시간 제한·형식 오류 시 `weather-sample.json`을 사용하고 예제/실제 아님 표시와 이유를 보여줍니다. 브라우저의 서버 요청 실패에도 공개 예제 파일로 전환합니다. 로컬 실제 연결을 원할 때만 `dashboard/.env.example`을 `dashboard/.env.local`로 복사해 값을 직접 넣고 개발 서버를 재시작하세요. 상위 폴더의 기존 `.env.local`은 읽지 않습니다.

## 로컬 검증 및 전달용 복사본

```sh
cd dashboard
npm ci
npm run check:deploy
npm run build
npm run dev -- --host 127.0.0.1 --port 5176 --strictPort
```

`npm run check:deploy`는 앱 폴더만으로 가상 480행·준비 72건·두 기준일 분포·빈 환경변수·오류 예제 전환·실제 서버 함수 GET/POST 경계를 검사합니다. 원본 워크스페이스의 심화 검사는 `node scripts/verify-sales.mjs`, `node scripts/verify-operations.mjs`이며 이 두 검사는 상위 원본 자료가 필요합니다.

`npm run prepare:vercel`은 검토한 26개 파일만 `../results/vercel-upload/dashboard/`에 복사하고 SHA-256 목록을 만듭니다. 출력 폴더가 이미 있으면 덮어쓰지 않고 중단합니다. 복사본은 전달용이며 Git의 배포 폴더는 원래 `dashboard/`입니다. 로컬의 `node_modules/`, `dist/`, `.git/`, 키 파일, 업무 원본, 검사 결과는 전달 목록에서 제외됩니다. `.gitattributes`는 공개 입력 파일의 줄바꿈·BOM 등 원래 바이트를 유지합니다.

## 배포 후 사용자가 확인할 항목

- 새 브라우저/로그아웃 상태에서 URL 접근 범위 확인. 공개가 목적이면 의도한 사용자가 로그인 없이 열 수 있는지 점검합니다.
- 기본 매출 480건, 필터·검색·새 XLSX 저장, 목표 0 표시 `—`와 보고 공란, 행사 보드·날씨 탭 확인.
- Network에서 브라우저는 `/api/weather`만 호출하는지, 요청·응답·번들·Console에 키 값이나 `appid`가 없는지 확인. 서버 내부에서만 제공처에 `appid`를 보냅니다.
- Secret이 없으면 `missing-key` 예제 표시, 설정 후 성공하면 실제 연결·출처·관측 시각 확인. 제공처 오류 때 예제로 전환되는지 확인합니다. 오류 검사는 별도 Preview에서 진행하세요.
- 배포 URL·커밋·접근 범위·날씨 연결 상태만 인수 기록에 남기고 키 값은 기록하지 않습니다.

## 공식 안내

2026-10-20 확인: [Vite 배포](https://vercel.com/docs/frameworks/frontend/vite), [빌드·Root Directory](https://vercel.com/docs/builds/configure-a-build), [Secret 환경변수](https://vercel.com/docs/environment-variables/sensitive-environment-variables), [Node.js 함수](https://vercel.com/docs/functions/runtimes/node-js), [현재 날씨](https://openweathermap.org/api/current), [5일 예보](https://openweathermap.org/api/forecast5).

## 준비 단계 검사 결과 (2026-10-20)

- 기존 앱 `npm run build` 성공, 매출 회귀 14/14 및 행사·날씨 모의 검사 14/14 통과.
- 공개 자료 허용 목록, 가상 480행·72개 ID, 두 기준일 분포, 빈 보고양식·환경변수, 서버 함수 GET/POST·오류 예제 전환 검사 통과. 빌드 전에도 `prebuild`에서 이 검사를 자동 실행합니다.
- 개발 서버·빌드 미리보기에서 기본 480건, 세 탭, 예제 라벨 확인. 예제B점 필터의 요약·차트·표·보고 120건 일치, 실제 브라우저 다운로드 XLSX의 120행·매출 92,199만원·목표 92,240만원 재확인.
- 브라우저 관측 자산에서 날씨 요청은 키 없는 `/api/weather`; OpenWeather 직접 호출·키 쿼리 없음, Console 경고·오류 없음. HTTP 응답과 생성 번들은 로컬 키 문자열 및 자격증명 패턴을 별도로 검사합니다.
- 입력 원본과 기존 공개 자료의 SHA-256 전후 일치. 로컬 키·편집기 임시 파일은 제외 규칙으로 보호하며 값은 읽어서 대조만 하고 기록하지 않습니다. Git의 추적 파일·스테이징·도달 가능한 이력도 검사합니다.
- 실제 키로 제공처를 호출하거나 Vercel 배포·접근 정책을 변경한 결과는 아닙니다. Vercel 함수의 배포 환경 동작, 실시간 날씨 성공, 최종 공개 URL·로그아웃 접근 검증은 사용자의 배포 후 확인 항목입니다.
