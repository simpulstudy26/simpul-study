#!/bin/zsh
cd -- "${0:A:h}" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  print 'Python 3를 찾지 못했습니다. Python 3를 설치한 뒤 다시 실행해 주세요.'
else
  python3 server.py --port 8001 --open
fi
print '\n창을 닫으려면 Enter를 누르세요.'
read -r
