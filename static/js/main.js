const socket = io();
const userRole = document.body.dataset.role;

console.log("User role:", userRole);

function sendMessage() {
  const input = document.getElementById('msgInput');
  const msg = input.value.trim();
  if (msg) {
    socket.emit('send_message', {
      text: msg,
      timestamp: new Date().toLocaleString(),
      sender: userRole
    });
    input.value = '';
  }
}

let hiddenIndexes = [];

function renderMessage(msg, index) {
  if (hiddenIndexes.includes(index) && userRole === 'client') return;

  const messages = document.getElementById('messages');
  const isMine = msg.sender === userRole;

  const wrapper = document.createElement('div');
  wrapper.className = 'message-wrapper ' + (isMine ? 'right' : 'left');

  const bubble = document.createElement('div');
  bubble.className = 'message-card';

  const senderLabel = msg.sender === 'client' ? 'Client' : 'Staff';
  const senderName = isMine ? 'You' : senderLabel;

  bubble.innerHTML = `
    <div class="msg-label">${senderLabel}</div>
    <div class="msg-sender">${senderName}</div>
    <div class="msg-text">${msg.text}</div>
    <div class="msg-footer">
      <span class="msg-time">${msg.timestamp}</span>
      ${userRole === 'client' && msg.sender === 'client' ? `<button class="delete-btn" onclick="deleteMessage(${index})">🗑️</button>` : ''}
    </div>
  `;

  wrapper.appendChild(bubble);
  messages.appendChild(wrapper);
}

hiddenIndexes = JSON.parse(localStorage.getItem('hiddenMsgs') || '[]');

function deleteMessage(index) {
  hiddenIndexes.push(index);
  localStorage.setItem('hiddenMsgs', JSON.stringify(hiddenIndexes));
  // re-render
  document.getElementById('messages').innerHTML = '';
  fetch('/chat_history')
    .then(res => res.json())
    .then(data => data.forEach((msg, i) => renderMessage(msg, i)));
}

socket.on('receive_message', (msg) => renderMessage(msg));

fetch('/chat_history')
  .then(res => res.json())
  .then(data => data.forEach(renderMessage));

if (userRole === 'client') {
  const clearBtn = document.createElement('button');
  clearBtn.innerText = "Clear Chat";
  clearBtn.className = "btn danger";
  clearBtn.style.marginTop = "10px";
  clearBtn.onclick = () => {
    document.getElementById('messages').innerHTML = '';
  };
  document.querySelector('.chat').appendChild(clearBtn);
}

window.onload = function () {
  const mapContainer = document.getElementById('map');
  if (!mapContainer) return;

  let marker = null;
  let map = L.map('map').setView([32.7157, -117.1611], 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

  function placeMarker(lat, lng) {
    if (marker) map.removeLayer(marker);
    marker = L.marker([lat, lng]).addTo(map);
  }

  function updateCheckin(coords, timestamp) {
    document.getElementById('pin-coords').innerText = `📍 Pin: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
    const checkin = document.getElementById('client-checkin');
    if (checkin) {
      checkin.innerHTML = `
        <div class="checkin-entry">
          <span class="checkin-time">${timestamp}</span>
          <span class="checkin-desc">Client checked in at approx. location: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}</span>
        </div>
      `;
    }
  }

  if (userRole === 'staff') {
    fetch('/get_location')
      .then(res => res.json())
      .then(data => {
        if (data.coords) {
          placeMarker(data.coords.lat, data.coords.lng);
          updateCheckin(data.coords, data.timestamp);
        }
      });
  }

  if (userRole === 'client') {
    map.on('click', function (e) {
      const coords = { lat: e.latlng.lat, lng: e.latlng.lng };
      placeMarker(coords.lat, coords.lng);
      document.getElementById('pin-coords').innerText = `📍 Pin: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
      socket.emit('send_location', coords);
    });
  }

  socket.on('receive_location', ({ coords, timestamp }) => {
    placeMarker(coords.lat, coords.lng);
    updateCheckin(coords, timestamp);
  });

  socket.on('clear_location', () => {
    if (marker) {
      map.removeLayer(marker);
      marker = null;
    }
    document.getElementById('pin-coords').innerText = '';
    const checkin = document.getElementById('client-checkin');
    if (checkin) checkin.innerHTML = '';
  });
};

fetch('/resources')
  .then(res => res.json())
  .then(data => {
    const container = document.getElementById('resources');
    container.innerHTML = data.resources.map(r =>
      `<div class="resource-card">
         <a href="${r.url}" target="_blank">${r.name}</a>
       </div>`
    ).join('');
  });

