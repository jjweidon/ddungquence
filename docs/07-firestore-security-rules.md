# 07. Firestore Security Rules(초안)

> 목표: (1) 참가자만 방을 읽기, (2) 손패는 본인만 읽기, (3) 게임 중 public 상태 업데이트는 **현재 턴 플레이어만** 가능.

## 1) 컬렉션 전제(참고)
- `rooms/{roomId}`: public room + public game state
- `rooms/{roomId}/players/{uid}`: public 참가자 정보
- `rooms/{roomId}/privateHands/{uid}`: private 손패(본인만 read)
- `rooms/{roomId}/privateDealer/deck`: private 덱(host만 read/write)
- `roomCodes/{code}`: roomCode → roomId 매핑(입장용, read 공개)

## 2) 룰 작성 주의
- Firestore 규칙은 “완전한 게임 규칙 검증”에 적합하지 않다.
- MVP는 **친구방 신뢰 모델**로, 최소한의 권한 통제만 한다.
- 치트 방지는 차기(P2)에서 별도 설계(16 문서).

## 3) Rules 예시

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() {
      return request.auth != null;
    }

    function roomRef(roomId) {
      return /databases/$(database)/documents/rooms/$(roomId);
    }

    function room(roomId) {
      return get(roomRef(roomId));
    }

    function isHost(roomId) {
      return signedIn() && room(roomId).data.hostUid == request.auth.uid;
    }

    function isParticipant(roomId) {
      return signedIn()
        && exists(/databases/$(database)/documents/rooms/$(roomId)/players/$(request.auth.uid));
    }

    function isLobby(roomId) {
      return room(roomId).data.status == "lobby";
    }

    function isPlaying(roomId) {
      return room(roomId).data.status == "playing";
    }

    // 입장 코드 조회용 (read 공개)
    match /roomCodes/{code} {
      allow read: if true;
      allow create: if signedIn()
        && request.resource.data.roomId is string
        && request.resource.data.createdAt is timestamp;
      allow update, delete: if false; // MVP 고정(방 코드는 불변)
    }

    match /rooms/{roomId} {
      // 참가자만 방 읽기
      allow read: if isParticipant(roomId) || isHost(roomId);

      // 방 생성: 생성자가 host로 생성
      allow create: if signedIn()
        && request.resource.data.hostUid == request.auth.uid
        && request.resource.data.status == "lobby";

      // 방 업데이트:
      // - lobby: host만
      // - playing: currentUid(현재 턴)만
      allow update: if signedIn() && (
        (isLobby(roomId) && isHost(roomId)) ||
        (isPlaying(roomId)
          && request.auth.uid == resource.data.game.currentUid
          && request.resource.data.game.version == resource.data.game.version + 1)
      );

      allow delete: if false; // MVP: 수동 삭제/정리는 차기

      // 참가자/관전자 public 프로필 (players에 participant·spectator 모두 등록, role로 구분)
      match /players/{uid} {
        allow read: if isParticipant(roomId) || isHost(roomId);  // isParticipant = 방 내 참여자 또는 관전자

        // 참가 등록: 본인 문서만 생성. role=participant(참가 자리 있을 때) 또는 role=spectator(참가 자리 없을 때, 관전 2명 미만일 때만)
        allow create: if signedIn()
          && request.auth.uid == uid
          && isLobby(roomId);

        // 본인 프로필 업데이트(닉네임/ready/team/lastSeenAt 등)
        allow update: if signedIn()
          && request.auth.uid == uid;

        allow delete: if signedIn()
          && request.auth.uid == uid; // 나가기
      }

      // 손패: 본인만 read
      match /privateHands/{uid} {
        allow read: if signedIn() && request.auth.uid == uid;

        // write 정책(선택):
        // 1) 본인만 write (자기 손패는 자기만 바꿈)
        // 2) host도 write 가능 (딜링을 host가 수행)
        allow create, update: if signedIn()
          && (request.auth.uid == uid || isHost(roomId));

        allow delete: if false;
      }

      // 덱: host만
      match /privateDealer/{docId} {
        allow read, write: if isHost(roomId);
      }

      // 이벤트 로그: 참가자 read, 현재 턴/host write (선택)
      match /events/{eventId} {
        allow read: if isParticipant(roomId) || isHost(roomId);
        allow create: if signedIn() && (
          isHost(roomId) || (isPlaying(roomId) && request.auth.uid == room(roomId).data.game.currentUid)
        );
        allow update, delete: if false;
      }
    }
  }
}
```

## 4) 실무 메모
- `roomCodes` read가 열려 있으므로, 공개 배포 시에는 App Check, rate-limit(클라이언트), 코드 길이 증가(8~10) 등을 고려한다.
- `rooms/{roomId}` update 규칙은 “게임 내용 검증”을 거의 하지 않는다. MVP는 의도적으로 단순화했다.

## DoD 체크리스트
- [ ] 타 uid로 `privateHands/{uid}`를 읽을 수 없다
- [ ] 게임 중 public 상태 update는 currentUid만 가능하다
- [ ] roomCodes를 통해 roomId를 조회하고 참가 등록이 가능하다
