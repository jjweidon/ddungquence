const cornerFontSize = 24;  // 좌상단, 우하단 숫자와 무늬 크기
const centerFontSize = 28;  // 중앙 무늬들의 크기
const aceFontSize = 64;     // A 카드 중앙 무늬 크기

// SVG 카드 무늬 경로 정의
const getSuitPath = (suit, size = 1) => {
  // 기본 크기 조정
  const scale = size;
  
  switch(suit) {
    case '♠': // 스페이드
      return `<path d="M${0 * scale},${-8 * scale}
        C${-7 * scale},${-4 * scale} ${-9 * scale},${0 * scale} ${-9 * scale},${3 * scale}
        C${-9 * scale},${7 * scale} ${-5 * scale},${9 * scale} ${0 * scale},${5 * scale}
        C${5 * scale},${9 * scale} ${9 * scale},${7 * scale} ${9 * scale},${3 * scale}
        C${9 * scale},${0 * scale} ${7 * scale},${-4 * scale} ${0 * scale},${-8 * scale}Z
        M${0 * scale},${5 * scale}
        L${-3.5 * scale},${11 * scale}
        L${3.5 * scale},${11 * scale}
        Z" fill="black" />`;
    case '♥': // 하트
      return `<path d="M${0 * scale},${10 * scale}
        C${-5 * scale},${5 * scale} ${-10 * scale},${0 * scale} ${-10 * scale},${-5 * scale}
        C${-10 * scale},${-9 * scale} ${-7 * scale},${-10 * scale} ${-5 * scale},${-10 * scale}
        C${-2 * scale},${-10 * scale} ${0 * scale},${-8 * scale} ${0 * scale},${-5 * scale}
        C${0 * scale},${-8 * scale} ${2 * scale},${-10 * scale} ${5 * scale},${-10 * scale}
        C${7 * scale},${-10 * scale} ${10 * scale},${-9 * scale} ${10 * scale},${-5 * scale}
        C${10 * scale},${0 * scale} ${5 * scale},${5 * scale} ${0 * scale},${10 * scale}Z" fill="red" />`;
    case '♦': // 다이아몬드
      return `<path d="M${0 * scale},${-10 * scale}
        L${-7.5 * scale},${0 * scale}
        L${0 * scale},${10 * scale}
        L${7.5 * scale},${0 * scale}Z" fill="red" />`;
    case '♣': // 클로버
      return `
        <path d="M${0 * scale},${-8 * scale} a${5.5 * scale},${5.5 * scale} 0 1,0 ${0.1 * scale},0 Z" fill="black" />
        <path d="M${-5 * scale},${-2 * scale} a${5.5 * scale},${5.5 * scale} 0 1,0 ${0.1 * scale},0 Z" fill="black" />
        <path d="M${5 * scale},${-2 * scale} a${5.5 * scale},${5.5 * scale} 0 1,0 ${0.1 * scale},0 Z" fill="black" />
        <path d="M${0 * scale},${5 * scale} L${-3 * scale},${13 * scale} L${3 * scale},${13 * scale} Z" fill="black" />`;
    default:
      return '';
  }
};

// 숫자 카드 템플릿 (2-10)
const createNumberCardSVG = (suit, number, positions) => `
<svg width="169" height="244" viewBox="0 0 169 244" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- 카드 배경 -->
  <rect width="169" height="244" rx="12" fill="white" stroke="#E5E5E5"/>
  
  <!-- 좌상단 숫자와 무늬 -->
  <g transform="translate(20, 30)">
    <text font-family="Arial" font-size="${cornerFontSize}" font-weight="bold" fill="${suit === '♥' || suit === '♦' ? '#FF0000' : '#000000'}" ${number === '10' ? 'x="-8"' : ''}>${number}</text>
    <g transform="translate(8, 14) scale(0.8)">
      ${getSuitPath(suit)}
    </g>
  </g>
  
  <!-- 우하단 숫자와 무늬 (180도 회전) -->
  <g transform="translate(149, 214) rotate(180)">
    <text font-family="Arial" font-size="${cornerFontSize}" font-weight="bold" fill="${suit === '♥' || suit === '♦' ? '#FF0000' : '#000000'}" ${number === '10' ? 'x="-8"' : ''}>${number}</text>
    <g transform="translate(8, 14) scale(0.8)">
      ${getSuitPath(suit)}
    </g>
  </g>
  
  <!-- 중앙 무늬들 -->
  ${positions.map(pos => `
    <g transform="translate(${pos.x}, ${pos.y})">
      ${getSuitPath(suit, 1.2)}
    </g>
  `).join('')}
</svg>
`;

// 문자 카드 템플릿 (J,Q,K)
const createFaceCardSVG = (suit, rank, isOneEyed = false) => `
<svg width="169" height="244" viewBox="0 0 169 244" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- 카드 배경 -->
  <rect width="169" height="244" rx="12" fill="white" stroke="#E5E5E5"/>
  
  <!-- 좌상단 숫자와 무늬 -->
  <g transform="translate(20, 30)">
    <text font-family="Arial" font-size="${cornerFontSize}" font-weight="bold" fill="${suit === '♥' || suit === '♦' ? '#FF0000' : '#000000'}">${rank}</text>
    <g transform="translate(8, 14) scale(0.8)">
      ${getSuitPath(suit)}
    </g>
  </g>
  
  <!-- 우하단 숫자와 무늬 (180도 회전) -->
  <g transform="translate(149, 214) rotate(180)">
    <text font-family="Arial" font-size="${cornerFontSize}" font-weight="bold" fill="${suit === '♥' || suit === '♦' ? '#FF0000' : '#000000'}">${rank}</text>
    <g transform="translate(8, 14) scale(0.8)">
      ${getSuitPath(suit)}
    </g>
  </g>
  
  <!-- 중앙 이미지 -->
  <g transform="translate(84.5, 122)">
    ${getFaceImage(rank, isOneEyed, suit === '♥' || suit === '♦')}
  </g>
</svg>
`;

// A 카드 템플릿
const createAceCardSVG = (suit) => `
<svg width="169" height="244" viewBox="0 0 169 244" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- 카드 배경 -->
  <rect width="169" height="244" rx="12" fill="white" stroke="#E5E5E5"/>
  
  <!-- 좌상단 숫자와 무늬 -->
  <g transform="translate(20, 30)">
    <text font-family="Arial" font-size="${cornerFontSize}" font-weight="bold" fill="${suit === '♥' || suit === '♦' ? '#FF0000' : '#000000'}">A</text>
    <g transform="translate(8, 14) scale(0.8)">
      ${getSuitPath(suit)}
    </g>
  </g>
  
  <!-- 우하단 숫자와 무늬 (180도 회전) -->
  <g transform="translate(149, 214) rotate(180)">
    <text font-family="Arial" font-size="${cornerFontSize}" font-weight="bold" fill="${suit === '♥' || suit === '♦' ? '#FF0000' : '#000000'}">A</text>
    <g transform="translate(8, 14) scale(0.8)">
      ${getSuitPath(suit)}
    </g>
  </g>
  
  <!-- 중앙 큰 무늬 -->
  <g transform="translate(84.5, 122) scale(3)">
    ${getSuitPath(suit)}
  </g>
</svg>
`;

// O 카드 템플릿
const createOCardSVG = () => `
<svg width="169" height="244" viewBox="0 0 169 244" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- 카드 배경 -->
  <rect width="169" height="244" rx="12" fill="white" stroke="#E5E5E5"/>
  
  <!-- 중앙 검은 원 -->
  <circle cx="84.5" cy="122" r="40" stroke="#000000" stroke-width="10" fill="none" stroke-opacity="1"/>
</svg>
`;

// getFaceImage 함수 추가
const getFaceImage = (rank, isOneEyed, isRed) => {
  const color = isRed ? '#FF0000' : '#000000';
  const faceColor = '#FFE4B5';

  switch (rank) {
    case 'K':
      return `
        <!-- 왕관 -->
        <path d="M-20 -40 L20 -40 L15 -30 L10 -35 L0 -25 L-10 -35 L-15 -30 Z" fill="#FFD700"/>
        <!-- 얼굴 -->
        <circle cx="0" cy="-15" r="20" fill="${faceColor}"/>
        <!-- 눈 -->
        <circle cx="-8" cy="-18" r="2" fill="#000000"/>
        <circle cx="8" cy="-18" r="2" fill="#000000"/>
        <!-- 코 -->
        <path d="M0 -15 Q2 -12 0 -10" stroke="#000000" fill="none"/>
        <!-- 입 -->
        <path d="M-5 -5 Q0 -2 5 -5" stroke="#000000" fill="none"/>
        <!-- 옷깃 -->
        <path d="M-20 10 Q0 40 20 10" fill="#4169E1"/>
      `;
    case 'Q':
      return `
        <!-- 왕관 -->
        <path d="M-15 -40 L15 -40 L10 -30 L5 -35 L0 -25 L-5 -35 L-10 -30 Z" fill="#FFD700"/>
        <!-- 얼굴 -->
        <circle cx="0" cy="-15" r="18" fill="${faceColor}"/>
        <!-- 눈 -->
        <circle cx="-6" cy="-18" r="1.5" fill="#000000"/>
        <circle cx="6" cy="-18" r="1.5" fill="#000000"/>
        <!-- 코 -->
        <path d="M0 -15 Q1 -12 0 -10" stroke="#000000" fill="none"/>
        <!-- 입 -->
        <path d="M-4 -5 Q0 -2 4 -5" stroke="#000000" fill="none"/>
        <!-- 드레스 -->
        <path d="M-15 10 Q0 45 15 10" fill="#FF69B4"/>
      `;
    case 'J':
      return `
        <g transform="translate(-100, 75) scale(0.01, 0.01)">
          ${isOneEyed ? 
            `<!-- j_1.svg (한 눈) -->
            <g transform="translate(0, 2048) scale(1, -1)" fill="${color}" stroke="none">
              <path d="M10260 16269 c0 -769 -10 -5562 -15 -7303 -4 -1347 -7 -1691 -17
              -1698 -33 -22 -536 39 -848 103 -924 190 -1955 642 -2666 1170 -95 69 -136 84
              -148 53 -4 -9 0 -26 7 -38 7 -12 21 -41 31 -66 10 -25 42 -81 71 -125 319
              -481 1413 -1137 2493 -1494 390 -129 795 -217 1004 -216 l68 0 0 -1447 c0
              -1374 1 -1447 18 -1441 62 23 620 379 872 556 782 549 1526 1222 2131 1927
              1755 2045 2490 4467 1978 6512 -184 736 -508 1376 -993 1963 -129 156 -467
              494 -626 625 -648 536 -1384 912 -2260 1155 -326 90 -787 179 -992 191 l-108
              7 0 -434z m2445 -4179 c491 -45 935 -260 1254 -606 90 -98 117 -140 101 -159
              -18 -22 -38 -18 -74 13 -87 76 -334 176 -561 227 -307 69 -559 89 -999 82
              -419 -7 -750 -42 -1114 -119 -186 -39 -206 -40 -210 -11 -2 16 15 37 74 87
              417 356 983 536 1529 486z m1199 -3486 c14 -14 14 -19 3 -42 -8 -15 -29 -58
              -47 -97 -47 -102 -110 -186 -230 -305 -669 -669 -2288 -1418 -3244 -1500 -87
              -8 -122 -7 -132 1 -11 9 -14 69 -14 308 l0 296 93 3 c201 6 589 62 877 127
              887 201 1804 608 2510 1113 112 81 145 103 167 111 1 1 9 -6 17 -15z"/>
              <path d="M7668 12089 c-379 -33 -771 -194 -1058 -434 -103 -87 -290 -283 -290
              -306 0 -40 48 -54 72 -21 7 10 45 37 83 60 191 113 505 199 890 244 177 21
              858 18 1065 -5 234 -26 482 -63 650 -99 184 -39 204 -40 208 -11 2 16 -15 37
              -74 87 -421 359 -983 536 -1546 485z"/>
            </g>` : 
            `<!-- j_2.svg (두 눈) -->
            <g transform="translate(0, 2048) scale(1, -1)" fill="${color}" stroke="none">
              <path d="M10045 16694 c-97 -11 -415 -68 -582 -105 -881 -193 -1699 -555
              -2348 -1038 -221 -165 -372 -296 -581 -505 -206 -206 -336 -355 -481 -553
              -768 -1042 -1090 -2338 -932 -3748 290 -2582 2168 -5206 4924 -6875 96 -58
              181 -103 195 -103 14 0 99 45 195 103 2756 1669 4634 4293 4924 6875 158 1410
              -164 2706 -932 3748 -145 198 -275 347 -481 553 -417 417 -838 721 -1376 993
              -591 300 -1202 498 -1915 621 -151 27 -211 32 -375 35 -107 2 -213 1 -235 -1z
              m-1995 -4605 c430 -39 843 -211 1164 -485 59 -50 76 -71 74 -87 -4 -29 -24
              -28 -210 11 -364 77 -695 112 -1114 119 -440 7 -692 -13 -999 -82 -227 -51
              -474 -151 -561 -227 -36 -31 -56 -35 -74 -13 -16 19 11 61 101 159 402 437
              1004 662 1619 605z m4655 1 c491 -45 935 -260 1254 -606 90 -98 117 -140 101
              -159 -18 -22 -38 -18 -74 13 -87 76 -334 176 -561 227 -307 69 -559 89 -999
              82 -419 -7 -750 -42 -1114 -119 -186 -39 -206 -40 -210 -11 -2 16 15 37 74 87
              417 356 983 536 1529 486z m-5952 -3577 c798 -574 1874 -1021 2852 -1183 509
              -84 761 -84 1270 0 978 162 2054 609 2852 1183 71 51 137 96 146 100 9 3 23
              -1 32 -9 13 -13 13 -19 2 -42 -8 -15 -29 -58 -47 -97 -47 -102 -110 -186 -230
              -305 -669 -669 -2288 -1418 -3244 -1500 -87 -8 -122 -7 -132 1 -11 9 -17 9
              -28 0 -10 -8 -45 -9 -132 -1 -956 82 -2575 831 -3244 1500 -120 119 -183 203
              -230 305 -18 39 -39 82 -47 97 -11 23 -11 29 2 42 9 8 23 12 32 9 9 -4 75 -49
              146 -100z"/>
            </g>`
          }
        </g>
      `;
    default:
      return '';
  }
};

// getNumberPositions 함수 수정 - 수평 중앙정렬을 위한 x 좌표 재조정
const getNumberPositions = (number) => {
  const centerX = 84.5;  // 카드의 정중앙 X좌표
  const spacing = 50;    // 좌우 열 사이의 간격

  // y좌표 기준점들을 25씩 더 아래로 이동 (기존 10 + 추가 15)
  const row1 = 72;   // 57 -> 72
  const row2 = 102;  // 87 -> 102
  const row3 = 132;  // 117 -> 132
  const row4 = 162;  // 147 -> 162
  const row5 = 192;  // 177 -> 192

  switch (number) {
    case '2':
      return [
        { x: centerX, y: 72 },
        { x: centerX, y: 162 }
      ];
    case '3':
      return [
        { x: centerX, y: 72 },
        { x: centerX, y: 112 },
        { x: centerX, y: 162 }
      ];
    case '4':
      return [
        { x: centerX - spacing/2, y: 72 },
        { x: centerX + spacing/2, y: 72 },
        { x: centerX - spacing/2, y: 162 },
        { x: centerX + spacing/2, y: 162 }
      ];
    case '5':
      return [
        { x: centerX - spacing/2, y: 72 },
        { x: centerX + spacing/2, y: 72 },
        { x: centerX, y: 112 },
        { x: centerX - spacing/2, y: 162 },
        { x: centerX + spacing/2, y: 162 }
      ];
    case '6':
      return [
        { x: centerX - spacing/2, y: 72 },
        { x: centerX + spacing/2, y: 72 },
        { x: centerX - spacing/2, y: 112 },
        { x: centerX + spacing/2, y: 112 },
        { x: centerX - spacing/2, y: 162 },
        { x: centerX + spacing/2, y: 162 }
      ];
    case '7':
      return [
        { x: centerX - spacing/2, y: 72 },
        { x: centerX + spacing/2, y: 72 },
        { x: centerX - spacing/2, y: 112 },
        { x: centerX, y: 112 },
        { x: centerX + spacing/2, y: 112 },
        { x: centerX - spacing/2, y: 162 },
        { x: centerX + spacing/2, y: 162 }
      ];
    case '8':
      return [
        { x: centerX - spacing/2, y: row1 },
        { x: centerX + spacing/2, y: row1 },
        { x: centerX - spacing/2, y: row2 },
        { x: centerX + spacing/2, y: row2 },
        { x: centerX - spacing/2, y: row3 },
        { x: centerX + spacing/2, y: row3 },
        { x: centerX - spacing/2, y: row4 },
        { x: centerX + spacing/2, y: row4 }
      ];
    case '9':
      return [
        { x: centerX - spacing/2, y: row1 },
        { x: centerX + spacing/2, y: row1 },
        { x: centerX - spacing/2, y: row2 },
        { x: centerX, y: row2 },
        { x: centerX + spacing/2, y: row2 },
        { x: centerX - spacing/2, y: row3 },
        { x: centerX + spacing/2, y: row3 },
        { x: centerX - spacing/2, y: row4 },
        { x: centerX + spacing/2, y: row4 }
      ];
    case '10':
      return [
        { x: centerX - spacing/2, y: row1 },
        { x: centerX + spacing/2, y: row1 },
        { x: centerX - spacing/2, y: row2 },
        { x: centerX, y: row2 },
        { x: centerX + spacing/2, y: row2 },
        { x: centerX - spacing/2, y: row3 },
        { x: centerX, y: row3 },
        { x: centerX + spacing/2, y: row3 },
        { x: centerX - spacing/2, y: row4 },
        { x: centerX + spacing/2, y: row4 }
      ];
    default:
      return [];
  }
};

module.exports = { createNumberCardSVG, createFaceCardSVG, createAceCardSVG, createOCardSVG, getNumberPositions }; 