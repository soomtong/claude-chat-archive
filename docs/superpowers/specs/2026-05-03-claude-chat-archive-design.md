# claude-chat-archive 설계 문서

- **작성일**: 2026-05-03
- **상태**: Draft → User Review
- **대상 패키지**: `claude-chat-archive` (npm)

## 1. 목적

Claude.ai에서 다운로드한 사용자 export(`conversations.json` + `projects/*.json`)를 가독성 높은 마크다운 아카이브로 변환한다. 사용자는 `npx`/`bunx`로 글로벌 설치 없이 즉시 실행할 수 있어야 한다. 결과물은 Obsidian 등 일반 마크다운 뷰어에서 바로 탐색 가능한 형태여야 한다.

## 2. 데이터 스키마 조사 결과

| 파일                           | 크기 / 개수               | 주요 키                                                                                                             |
| ------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `conversations.json`           | ~74MB / 177 conversations | `uuid, name, summary, created_at, updated_at, account, chat_messages`                                               |
| 메시지 (`chat_messages[]`)     | n/a                       | `uuid, sender, content, attachments, files, parent_message_uuid, created_at, updated_at`                            |
| 콘텐츠 타입 (`content[].type`) | 5종                       | `text, thinking, tool_use, tool_result, token_budget`                                                               |
| `attachments[]`                | inline                    | `file_name, file_size, file_type, extracted_content` (텍스트 본문 임베드)                                           |
| `files[]`                      | uuid only                 | `file_uuid, file_name` (실제 바이너리는 export에 포함되지 않음)                                                     |
| `projects/*.json`              | 15개                      | `uuid, name, description, is_private, is_starter_project, prompt_template, created_at, updated_at, creator, docs[]` |
| project `docs[]`               | 임베드                    | `uuid, filename, content` (대부분 프로젝트는 docs 비어있음, 2개만 실제 docs 보유)                                   |

**중요**: conversations에는 `project_uuid`나 그 외 어떤 프로젝트 참조 필드도 존재하지 않는다. 50개 샘플에서 project/doc UUID 매칭 0건 확인. 따라서 chat ↔ project 자동 연결은 불가능하며 평면 출력 구조로 진행한다.

## 3. 핵심 설계 결정

### 3.1 출력 디렉토리 구조

평면 구조 (Obsidian 친화):

```
output/
├── chats/
│   ├── 2026-01-29 PDF 버퍼를 이미지로 변환.md
│   ├── 2026-01-19 untitled-4811c448.md
│   └── ...
├── projects/
│   ├── 프로그래밍이란 무엇인가.md          # docs 없음 → 단일 파일
│   └── How to use Claude/                  # docs 있음 → 폴더
│       ├── README.md
│       └── docs/
│           └── Claude prompting guide.md
└── attachments/
    └── <chat-uuid>/
        └── <filename>
```

### 3.2 콘텐츠 모드

3단계 모드, 기본값 `standard`:

| 모드       | text | thinking                 | tool_use / tool_result | token_budget |
| ---------- | ---- | ------------------------ | ---------------------- | ------------ |
| `minimal`  | ✅   | ❌                       | ❌                     | ❌           |
| `standard` | ✅   | ✅ (collapsible callout) | ✅ (한 줄 요약)        | ❌           |
| `full`     | ✅   | ✅ (callout)             | ✅ (전체 코드 블록)    | ✅           |

`standard` 모드 tool 한 줄 요약 포맷: `🔧 \`<tool_name>(<요약된 input>)\` → <결과 요약 또는 길이>`예: `` 🔧`Read("/src/foo.ts")` → 142 lines ``

개별 토글: `--no-thinking`, `--no-tools`로 모드 위에서 세부 비활성화 가능.

### 3.3 첨부 파일 (하이브리드)

- `extracted_content.length < attachmentThreshold` (기본 4096 bytes): 본문 내 collapsible callout으로 인라인
- 그 이상: `attachments/<chat-uuid>/<safe-filename>`로 분리, 본문에 상대 경로 링크
- `files[]`: 바이너리 부재. placeholder 표기 `📎 [missing] <file_name>` (filename 비어있으면 file_uuid 표시)

### 3.4 파일명 규칙

- 형식: `YYYY-MM-DD <대화 제목>.md`
- 한글/유니코드 보존, 파일시스템 금지 문자(`/\:*?"<>|`)만 `_`로 치환
- 무제 대화: 첫 사용자 메시지 첫 30자 + uuid 8자 prefix → `2026-01-19 untitled-4811c448.md`
- 동일 날짜·제목 충돌: `-2`, `-3` 자동 suffix

### 3.5 마크다운 frontmatter

```yaml
---
uuid: <conversation uuid>
title: <name 또는 자동 생성>
created: <ISO 8601, Z>
updated: <ISO 8601, Z>
message_count: <int>
attachment_count: <int>
tags: [claude-chat]
summary: |
  <export 원본의 summary 필드, 비어있으면 생략>
---
```

프로젝트 frontmatter:

```yaml
---
uuid: <project uuid>
type: project
name: <project name>
created: <ISO 8601>
updated: <ISO 8601>
is_private: <bool>
is_starter_project: <bool>
creator: <full_name>
docs_count: <int>
---
```

### 3.6 CLI 인터페이스

```bash
# 가장 단순한 형태
npx claude-chat-archive ./export ./output

# 인자 1개: 해당 폴더가 export, 그 폴더 안에 ./output 생성
npx claude-chat-archive ./export

# 옵션 사용
npx claude-chat-archive ./export ./output \
  --mode full \
  --no-thinking \
  --attachment-threshold 8192 \
  --scope chats \
  --dry-run
```

| 옵션                               | 기본값     | 설명                             |
| ---------------------------------- | ---------- | -------------------------------- |
| `--mode <minimal\|standard\|full>` | `standard` | 콘텐츠 모드                      |
| `--no-thinking`                    | false      | thinking 콘텐츠 제외 (mode 무관) |
| `--no-tools`                       | false      | tool_use / tool_result 제외      |
| `--attachment-threshold <bytes>`   | `4096`     | 인라인/외부 분리 임계값          |
| `--scope <all\|chats\|projects>`   | `all`      | 출력 범위                        |
| `--dry-run`                        | false      | 파일 쓰지 않고 통계만 출력       |
| `--help`                           | —          | 사용법 출력                      |
| `--version`                        | —          | 버전 출력                        |

### 3.7 기술 스택

- **언어**: TypeScript
- **런타임 호환**: Node ≥ 20, Bun (둘 다 `npx`/`bunx`로 실행)
- **표준 API만 사용**: `node:fs/promises`, `node:path`, `node:util` (parseArgs)
- **런타임 의존성: 0개**
- **개발 의존성**: `@types/bun`, `oxlint`, `oxfmt`, `typescript`
- **빌드**: `bun build --target=node --outdir=dist src/cli.ts`
- **테스트**: `bun test`
- **shebang**: `#!/usr/bin/env node` (둘 다 호환)

## 4. 모듈 구조

```
src/
├── cli.ts                  # 진입점 (shebang, parseArgs, error handling)
├── config.ts               # CLI 옵션 → Config 정규화 + 검증
├── types.ts                # ClaudeExport 스키마 타입
├── reader/
│   ├── conversations.ts    # conversations.json 로드 + 파싱
│   └── projects.ts         # projects/*.json 일괄 로드
├── transform/
│   ├── message.ts          # ExportMessage → markdown (mode 분기)
│   ├── attachment.ts       # 인라인/외부 결정 + 렌더링
│   ├── filename.ts         # 파일명 생성 + sanitize + 충돌 회피
│   └── frontmatter.ts      # YAML frontmatter 직렬화
├── writer/
│   ├── chat.ts             # 단일 대화 → output/chats/*.md
│   ├── project.ts          # docs 유무에 따라 파일/폴더 분기
│   └── attachment.ts       # output/attachments/<uuid>/* 저장
└── index.ts                # programmatic API (향후 라이브러리 사용)
```

각 모듈은 단일 책임. transform 계층은 순수 함수 (입력 → 출력). writer 계층만 I/O 수행.

## 5. 데이터 흐름

```
[input dir]
    │
    ├── conversations.json ──► reader/conversations ──► ExportConversation[]
    │                                                        │
    │                                                        ▼
    │                                  transform/message ──► markdown blocks
    │                                  transform/attachment ──┐
    │                                  transform/frontmatter  │
    │                                                        ▼
    │                                  writer/chat ──► output/chats/*.md
    │                                                  └► writer/attachment ──► output/attachments/*
    │
    └── projects/*.json ──► reader/projects ──► ExportProject[]
                                                    │
                                                    ▼
                                  writer/project ──► output/projects/{name.md | name/}
```

## 6. 출력 예시 (standard 모드)

```md
---
uuid: 5a2e2c19-7df0-4a92-ad55-c52a5189bcbe
title: PDF 버퍼를 이미지로 변환
created: 2026-01-29T12:06:57Z
updated: 2026-01-29T12:07:25Z
message_count: 4
attachment_count: 0
tags: [claude-chat]
summary: |
  The user requested TypeScript code to convert PDF files...
---

# PDF 버퍼를 이미지로 변환

## 👤 User · 2026-01-29 12:06

pdfjs-dist를 사용해서 파일이 아니고 버퍼에 있는 pdf를 jpg or png 이미지로 변환하는 코드를 작성해 주세요.

## 🤖 Claude · 2026-01-29 12:06

> [!note]- 사고 과정
> 사용자가 pdfjs-dist를 사용해서 메모리 버퍼에 있는 PDF를...

pdfjs-dist를 사용해서 버퍼에 있는 PDF를 이미지로 변환하는 TypeScript 코드를 작성해드리겠습니다.

\`\`\`typescript
import \* as pdfjsLib from 'pdfjs-dist';
...
\`\`\`
```

## 7. 에러 처리 전략

| 상황                                    | 처리                                                                                          |
| --------------------------------------- | --------------------------------------------------------------------------------------------- |
| 입력 경로가 존재하지 않음               | 에러 메시지 + exit 1                                                                          |
| `conversations.json`이 입력 폴더에 없음 | 에러 메시지 + exit 1                                                                          |
| `conversations.json` 파싱 실패          | 파일 경로 + 바이트 오프셋 표시 + exit 1                                                       |
| 개별 메시지 변환 실패                   | 해당 메시지만 skip, stderr 경고 (uuid 포함), 작업 계속                                        |
| 출력 디렉토리가 비어있지 않음           | 경고 + 진행 (덮어쓰기), `--force` 같은 플래그 없음 — 사용자가 직접 관리                       |
| 출력 파일명 충돌                        | suffix `-2`, `-3` 자동 부여                                                                   |
| 처리 종료 시                            | 통계 출력: `chats: 175/177 (2 skipped), projects: 15/15, attachments: 23 inline / 5 external` |

## 8. 테스트 전략

| 테스트 종류                    | 대상                                                             |
| ------------------------------ | ---------------------------------------------------------------- | --------------------- |
| 단위 — `transform/message`     | 5개 콘텐츠 타입별 변환, 3개 mode 분기, sender별 헤더             |
| 단위 — `transform/attachment`  | threshold 경계값 (4095/4096/4097), 빈 content, 누락 filename     |
| 단위 — `transform/filename`    | 한글, 금지 문자, 무제, 충돌 처리                                 |
| 단위 — `transform/frontmatter` | YAML 이스케이프 (`:`, `                                          | `, multiline summary) |
| 단위 — `config`                | 인자 1개/2개, 잘못된 mode 값, 음수 threshold                     |
| 통합                           | 작은 fixture export 폴더 → 출력 검증 (디렉토리 구조 + 파일 내용) |
| 회귀                           | 실제 `conversations.json` 일부 (sanitize됨)를 fixture로          |

## 9. YAGNI / 비포함 항목

- **chat ↔ project 자동 연결**: 데이터에 단서 없음. 휴리스틱 매칭은 부정확.
- **인터랙티브 모드**: 추가 의존성, 자동화 저해. CLI 플래그로 충분.
- **HTML/PDF 출력**: 마크다운만으로 시작.
- **첨부 OCR / 바이너리 추출**: export에 바이너리 자체가 없음.
- **암호화/sanitize**: 사용자가 자기 데이터를 자기 머신에서 처리. 별도 보호 불필요.
- **점진적 업데이트 (incremental)**: 매번 전체 출력. 성능상 문제 없음.

## 10. 향후 확장 여지

- programmatic API (`src/index.ts`)를 통한 라이브러리 사용
- 콘텐츠 모드 커스텀 (사용자 정의 템플릿)
- 다른 LLM 플랫폼 export 지원 (별도 reader 추가)

## 11. 다음 단계

이 spec에 대한 사용자 검토 후, `superpowers:writing-plans` 스킬로 전환하여 구현 계획을 수립한다.
