import Peer from "peerjs";

let lastPeers: Peer[] = [];
function disconnectAllGracefullyOnUnload() {
  lastPeers.forEach((x) => x.destroy());
  window.removeEventListener("beforeunload", disconnectAllGracefullyOnUnload);
}
window.addEventListener("beforeunload", disconnectAllGracefullyOnUnload);

export function preparePeerConnection() {
  const inactivePeers = lastPeers.filter(
    (x) => x.destroyed || x.disconnected || !x.open,
  );
  inactivePeers.forEach((x) => x.destroy());
  lastPeers = lastPeers.filter(
    (x) => x.open && !x.destroyed && !x.disconnected,
  );
  if (lastPeers.length > 0) return lastPeers[0];
  return new Promise<Peer>((resolve, reject) => {
    const peer = new Peer();
    lastPeers.push(peer);
    function stopIt(reason?: any) {
      peer.destroy();
      reject(reason);
    }
    peer.on("error", stopIt);
    peer.on("disconnected", stopIt);
    peer.on("close", stopIt);
    peer.on("open", () => {
      peer.off("error", stopIt);
      peer.off("disconnected", stopIt);
      peer.off("close", stopIt);
      resolve(peer);
    });
  });
}
