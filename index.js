let patternHistory = [];
let videoStream = null; //To store video stream

function generatePattern() {
    const message = document.getElementById('messageInput').value.trim();
    
    if (!message) {
        alert('Please enter a message first');
        return;
    }

    // Show the generated section
    document.getElementById('generatedSection').style.display = 'block';
    // Hide imported section and clear any imported pattern when generating new pattern
    document.getElementById('importedSection').style.display = 'none';
    window.importedPublicKey = null;

    if (!window.keyPair) {
        window.keyPair = nacl.sign.keyPair();
    }

    const keyPair = window.keyPair;
    const messageBytes = new TextEncoder().encode(message);
    const signedMessage = nacl.sign(messageBytes, keyPair.secretKey);
    const signedMessageBase64 = nacl.util.encodeBase64(signedMessage);

    // Always show in main section
    document.getElementById('signedMessage').value = signedMessageBase64;
    renderGrid(signedMessage);

    // Save to history
    patternHistory.push({
        message: message,
        signedMessage: signedMessageBase64,
        pattern: signedMessage,
        timestamp: new Date().toISOString(),
        isImported: false
    });
}

function verifySignature() {
    const message = document.getElementById('messageInput').value;
    const signedMessageBase64 = document.getElementById('signedMessage').value;
    
    if (!signedMessageBase64) {
        console.error('Verification failed: No signed message to verify');
        alert('No signed message to verify');
        return;
    }

    const signedMessage = nacl.util.decodeBase64(signedMessageBase64);
    const publicKey = window.keyPair?.publicKey || window.importedPublicKey;

    if (!publicKey) {
        console.error('Verification failed: Public key not available');
        alert('Public key not available. Please generate or import a pattern first.');
        return;
    }

    try {
        console.group('Signature Verification Process');
        console.log('Starting verification...');
        console.log('Message:', message);
        console.log('Signed Message (base64):', signedMessageBase64);
        console.log('Public Key:', nacl.util.encodeBase64(publicKey));

        const verifiedMessage = nacl.sign.open(signedMessage, publicKey);
        
        if (verifiedMessage) {
            const decodedMessage = new TextDecoder().decode(verifiedMessage);
            console.log('✓ Verification Successful');
            console.log('Original Message:', message);
            console.log('Decoded Message:', decodedMessage);
            console.log('Signature Valid: YES');
            console.groupEnd();
            alert('✓ Signature Verified');
        } else {
            console.log('✗ Verification Failed');
            console.log('Possible reasons:');
            console.log('- Message was tampered with');
            console.log('- Wrong public key used');
            console.log('- Signature corrupted');
            console.groupEnd();
            alert('✗ Signature Verification Failed');
        }
    } catch (error) {
        console.error('Verification error:', error);
        console.groupEnd();
        alert('Error during signature verification');
    }
}

function exportSignedMessage() {
    const message = document.getElementById('messageInput').value;
    const signedMessage = document.getElementById('signedMessage').value;
    const publicKey = nacl.util.encodeBase64(window.keyPair?.publicKey || new Uint8Array());

    const exportData = {
        message,
        signedMessage,
        publicKey,
        timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'pattern-export.json';
    link.click();
}

function importSignedMessage(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            
            // Show in imported section
            document.getElementById('importedSection').style.display = 'block';
            document.getElementById('importedMessage').value = data.signedMessage || '';
            document.getElementById('signedMessage').value = ''; //clear signed message
            
            const signedBytes = nacl.util.decodeBase64(data.signedMessage);
            const publicKey = nacl.util.decodeBase64(data.publicKey);

            const verified = nacl.sign.open(signedBytes, publicKey);

            if (verified) {
                alert('✓ Imported pattern verified!');
                window.importedPublicKey = publicKey;
                renderGrid(signedBytes);
                
                // Add to history
                patternHistory.push({
                    message: data.message,
                    signedMessage: data.signedMessage,
                    pattern: signedBytes,
                    timestamp: data.timestamp || new Date().toISOString(),
                    isImported: true
                });
            } else {
                alert('✗ Verification failed on import');
            }
        } catch (err) {
            console.error('Import error:', err);
            alert('Invalid file format or corrupted data');
        }
    };
    reader.readAsText(file);
}

function renderGrid(signedMessage, gridSize = 15) {
    const container = document.getElementById('colorGridContainer');
    container.innerHTML = '';
    container.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
    container.style.gridTemplateRows = `repeat(${gridSize}, 1fr)`;

    for (let i = 0; i < gridSize * gridSize; i++) {
        const r = signedMessage[i % signedMessage.length] || 0;
        const g = signedMessage[(i + 1) % signedMessage.length] || 0;
        const b = signedMessage[(i + 2) % signedMessage.length] || 0;

        const box = document.createElement('div');
        box.classList.add('colorBox');
        box.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
        container.appendChild(box);
    }
}

function showHistory() {
    const historyPopup = document.getElementById('historyPopup');
    const overlay = document.getElementById('overlay');
    
    historyPopup.style.display = 'block';
    overlay.style.display = 'block';

    const historyContent = document.getElementById('historyContent');
    historyContent.innerHTML = '';

    if (patternHistory.length === 0) {
        historyContent.innerHTML = '<p class="empty-history">No patterns generated yet. Create some patterns to see them here!</p>';
        return;
    }

    // Show newest first
    const reversedHistory = [...patternHistory].reverse();
    
    reversedHistory.forEach((item, index) => {
        const originalIndex = patternHistory.length - 1 - index;
        const historyItem = document.createElement('div');
        historyItem.classList.add('historyItem');

        historyItem.innerHTML = `
            <div><strong>Message:</strong> ${item.message || 'No message'}</div>
            <div><strong>Created:</strong> ${new Date(item.timestamp).toLocaleString()}</div>
            <div><strong>Signed Message:</strong></div>
            <div class="signed-message">${item.signedMessage}</div>
            <div class="historyGrid" id="historyColorGrid${originalIndex}"></div>
            <button onclick="loadHistoryPattern(${originalIndex})">Load This Pattern</button>
        `;

        historyContent.appendChild(historyItem);
        renderHistoryGrid(originalIndex, item.pattern);
    });
}

function renderHistoryGrid(index, signedMessage) {
    const historyColorGrid = document.getElementById(`historyColorGrid${index}`);
    historyColorGrid.innerHTML = '';
    const gridSize = 15;
    historyColorGrid.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
    historyColorGrid.style.gridTemplateRows = `repeat(${gridSize}, 1fr)`;
    
    for (let i = 0; i < gridSize * gridSize; i++) {
        const r = signedMessage[i % signedMessage.length] || 0;
        const g = signedMessage[(i + 1) % signedMessage.length] || 0;
        const b = signedMessage[(i + 2) % signedMessage.length] || 0;
        
        const box = document.createElement('div');
        box.classList.add('colorBox');
        box.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
        historyColorGrid.appendChild(box);
    }
}

function loadHistoryPattern(index) {
    const item = patternHistory[index];
    if (item) {
        if (item.isImported) {
            // Show in imported section
            document.getElementById('importedSection').style.display = 'block';
            document.getElementById('importedMessage').value = item.signedMessage || '';
            document.getElementById('signedMessage').value = '';
        } else {
            // Show in main section
            document.getElementById('importedSection').style.display = 'none';
            document.getElementById('signedMessage').value = item.signedMessage || '';
        }
        document.getElementById('scanSection').style.display = 'none'; //hide scan section

        document.getElementById('messageInput').value = item.message || '';
        renderGrid(item.pattern);
        closeHistoryPopup();
    }
}

function closeHistoryPopup() {
    document.getElementById('historyPopup').style.display = 'none';
    document.getElementById('overlay').style.display = 'none';
}
