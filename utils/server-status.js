const net = require('net');                                                 const logger = require('./logger');

/**
 * Get Minecraft server status using the Server List Ping protocol
 * @param {string} host - Server hostname or IP                              * @param {number} port - Server port
 * @param {number} timeout - Connection timeout in milliseconds              * @returns {Promise<Object>} Server status information
 */                                                                         async function getServerStatus(host, port = 25565, timeout = 5000) {
    return new Promise((resolve, reject) => {                                       const socket = new net.Socket();
        let buffer = Buffer.alloc(0);
        const timeoutId = setTimeout(() => {                                            socket.destroy();
            resolve({                                                                       online: false,
                host: host,                                                                 port: port,
                error: 'Connection timeout'                                             });
        }, timeout);
        socket.connect(port, host, () => {
            // Send handshake packet for status request (Protocol version 760 for 1.19.2)
            const handshakePacket = createHandshakePacket(host, port, 1); // 1 = status
            socket.write(handshakePacket);

            // Send status request packet
            const statusRequestPacket = Buffer.from([0x01, 0x00]);
            socket.write(statusRequestPacket);
        });

        socket.on('data', (data) => {
            buffer = Buffer.concat([buffer, data]);

            try {
                // Parse the response
                const result = parseStatusResponse(buffer);
                if (result) {
                    clearTimeout(timeoutId);
                    socket.destroy();
                    resolve({
                        online: true,
                        host: host,
                        port: port,
                        ...result
                    });
                }
            } catch (error) {
                logger.debug('Error parsing server response:', error);
            }
        });

        socket.on('error', (error) => {
            clearTimeout(timeoutId);
            logger.debug('Socket error:', error);
            resolve({
                online: false,
                host: host,
                port: port,
                error: error.message
            });
        });

        socket.on('close', () => {
            clearTimeout(timeoutId);
        });
    });
}

function createHandshakePacket(host, port, nextState) {
    const protocolVersion = 760; // 1.19.2 protocol version
    const hostBuffer = Buffer.from(host, 'utf8');

    let packet = Buffer.alloc(0);

    // Packet ID (0x00 for handshake)
    packet = Buffer.concat([packet, writeVarInt(0x00)]);

    // Protocol version                                                         packet = Buffer.concat([packet, writeVarInt(protocolVersion)]);

    // Server address length + address
    packet = Buffer.concat([packet, writeVarInt(hostBuffer.length)]);
    packet = Buffer.concat([packet, hostBuffer]);

    // Server port
    const portBuffer = Buffer.allocUnsafe(2);                                   portBuffer.writeUInt16BE(port, 0);
    packet = Buffer.concat([packet, portBuffer]);
    // Next state (1 for status, 2 for login)                                   packet = Buffer.concat([packet, writeVarInt(nextState)]);

    // Prepend packet length
    const length = writeVarInt(packet.length);
    return Buffer.concat([length, packet]);
}

function writeVarInt(value) {
    const bytes = [];                                                           while (value >= 0x80) {
        bytes.push((value & 0xFF) | 0x80);                                          value >>>= 7;
    }                                                                           bytes.push(value & 0xFF);
    return Buffer.from(bytes);                                              }

function readVarInt(buffer, offset = 0) {
    let value = 0;
    let position = 0;
    let currentByte;

    do {                                                                            if (offset + position >= buffer.length) {
            throw new Error('VarInt too long');
        }

        currentByte = buffer[offset + position];
        value |= (currentByte & 0x7F) << (position * 7);
        position++;

        if (position > 5) {
            throw new Error('VarInt too long');
        }                                                                       } while ((currentByte & 0x80) !== 0);

    return { value, bytesRead: position };
}

function parseStatusResponse(buffer) {
    if (buffer.length < 5) return null;

    try {
        let offset = 0;

        // Read packet length
        const packetLengthResult = readVarInt(buffer, offset);
        offset += packetLengthResult.bytesRead;

        // Read packet ID (should be 0x00)
        const packetIdResult = readVarInt(buffer, offset);
        offset += packetIdResult.bytesRead;

        if (packetIdResult.value !== 0x00) {
            return null;
        }

        // Read JSON response length
        const jsonLengthResult = readVarInt(buffer, offset);
        offset += jsonLengthResult.bytesRead;
        // Check if we have enough data                                             if (buffer.length < offset + jsonLengthResult.value) {
            return null;                                                            }

        // Read JSON response
        const jsonResponse = buffer.slice(offset, offset + jsonLengthResult.value).toString('utf8');
        const serverData = JSON.parse(jsonResponse);
        return {                                                                        version: serverData.version || { name: 'Unknown', protocol: 0 },
            players: serverData.players || { max: 0, online: 0, sample: [] },
            description: serverData.description || { text: '' },                        favicon: serverData.favicon || null,
            modinfo: serverData.modinfo || null                                     };

    } catch (error) {
        logger.debug('Error parsing status response:', error);                      return null;
    }                                                                       }

/**
 * Simple ping test to check if server is reachable                          * @param {string} host - Server hostname or IP
 * @param {number} port - Server port                                        * @param {number} timeout - Connection timeout in milliseconds
 * @returns {Promise<boolean>} True if server is reachable                   */
async function pingServer(host, port = 25565, timeout = 3000) {                 return new Promise((resolve) => {
        const socket = new net.Socket();
        const timeoutId = setTimeout(() => {                                            socket.destroy();
            resolve(false);
        }, timeout);

        socket.connect(port, host, () => {
            clearTimeout(timeoutId);
            socket.destroy();
            resolve(true);
        });

        socket.on('error', () => {
            clearTimeout(timeoutId);
            resolve(false);
        });
    });
}

module.exports = {
    getServerStatus,
    pingServer
};
