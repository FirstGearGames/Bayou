
// this will create a global object
const SimpleWeb = {
    webSockets: [],
    next: 1,
    pingWorkers: {},

    GetWebSocket: function (index) {
        return SimpleWeb.webSockets[index];
    },

    AddNextSocket: function (webSocket) {
        var index = SimpleWeb.next;
        SimpleWeb.next++;
        SimpleWeb.webSockets[index] = webSocket;
        return index;
    },

    RemoveSocket: function (index) {
        SimpleWeb.webSockets[index] = undefined;
    },

    setupPinging: function (index) {
        // Create a worker dynamically from a Blob
        const workerCode = `
            self.onmessage = function(e) {
                const { interval } = e.data;
                setInterval(() => {
                    self.postMessage("ping");
                }, interval);
            };
        `;
        const blob = new Blob([workerCode], { type: "application/javascript" });
        const worker = new Worker(URL.createObjectURL(blob));

        worker.onmessage = function (e) {
            if (e.data === "ping") {
                var webSocket = SimpleWeb.GetWebSocket(index);
                if (webSocket && webSocket.readyState === WebSocket.OPEN) {
                    // Create a binary ping message
                    var buffer = new ArrayBuffer(5); // 1 byte for PacketId + 4 bytes for timestamp
                    var view = new DataView(buffer);
                    view.setUint8(0, 14); // 14 is the PacketId for PingPong
                    view.setUint32(1, Math.floor(Date.now() / 1000), true);
                    webSocket.send(buffer);
                } else {
                    SimpleWeb.stopPinging(index);
                }
            }
        };

        // Start the worker with a 10s interval
        worker.postMessage({ interval: 10000 });

        // Store worker reference
        SimpleWeb.pingWorkers[index] = worker;
    },

    stopPinging: function (index) {
        if (SimpleWeb.pingWorkers[index]) {
            SimpleWeb.pingWorkers[index].terminate();
            delete SimpleWeb.pingWorkers[index];
        }
    }
};

function IsConnected(index) {
    var webSocket = SimpleWeb.GetWebSocket(index);
    if (webSocket) {
        return webSocket.readyState === webSocket.OPEN;
    } else {
        return false;
    }
}

function Connect(addressPtr, openCallbackPtr, closeCallBackPtr, messageCallbackPtr, errorCallbackPtr) {
    const address = UTF8ToString(addressPtr);
    console.log("Connecting to " + address);
    // Create webSocket connection.
    var webSocket = new WebSocket(address);
    webSocket.binaryType = "arraybuffer";
    const index = SimpleWeb.AddNextSocket(webSocket);

    webSocket.onopen = function (event) {
        console.log("Connected to " + address);
        SimpleWeb.setupPinging(index);
        dynCall("vi", openCallbackPtr, [index]);
    };

    webSocket.onclose = function (event) {
        console.log("Disconnected from " + address);
        SimpleWeb.stopPinging(index);
        dynCall("vi", closeCallBackPtr, [index]);
    };

    // Listen for messages
    webSocket.onmessage = function (event) {
        if (event.data instanceof ArrayBuffer) {
            var array = new Uint8Array(event.data);
            var arrayLength = array.length;

            var bufferPtr = _malloc(arrayLength);
            var dataBuffer = new Uint8Array(HEAPU8.buffer, bufferPtr, arrayLength);
            dataBuffer.set(array);

            dynCall("viii", messageCallbackPtr, [index, bufferPtr, arrayLength]);
            _free(bufferPtr);
        } else {
            console.error("message type not supported");
        }
    };

    webSocket.onerror = function (event) {
        console.error("Socket Error", event);
        dynCall("vi", errorCallbackPtr, [index]);
    };

    return index;
}

function Disconnect(index) {
    var webSocket = SimpleWeb.GetWebSocket(index);
    if (webSocket) {
        webSocket.close(1000, "Disconnect Called by Mirror");
    }

    SimpleWeb.RemoveSocket(index);
    SimpleWeb.stopPinging(index);
}

function Send(index, arrayPtr, offset, length) {
    var webSocket = SimpleWeb.GetWebSocket(index);
    if (webSocket) {
        const start = arrayPtr + offset;
        const end = start + length;
        const data = HEAPU8.buffer.slice(start, end);
        webSocket.send(data);
        return true;
    }
    return false;
}

const SimpleWebLib = {
    $SimpleWeb: SimpleWeb,
    IsConnected,
    Connect,
    Disconnect,
    Send
};
autoAddDeps(SimpleWebLib, "$SimpleWeb");
mergeInto(LibraryManager.library, SimpleWebLib);
