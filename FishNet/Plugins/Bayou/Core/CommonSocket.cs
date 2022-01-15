using FishNet.Transporting;
using System;
using System.Collections.Generic;

namespace FishNet.Bayou
{

    public abstract class CommonSocket
    {

        #region Public.
        /// <summary>
        /// Current ConnectionState.
        /// </summary>
        private LocalConnectionStates _connectionState = LocalConnectionStates.Stopped;
        /// <summary>
        /// Returns the current ConnectionState.
        /// </summary>
        /// <returns></returns>
        internal LocalConnectionStates GetConnectionState()
        {
            return _connectionState;
        }
        /// <summary>
        /// Sets a new connection state.
        /// </summary>
        /// <param name="connectionState"></param>
        protected void SetConnectionState(LocalConnectionStates connectionState, bool asServer)
        {
            //If state hasn't changed.
            if (connectionState == _connectionState)
                return;

            _connectionState = connectionState;
            if (asServer)
                Transport.HandleServerConnectionState(new ServerConnectionStateArgs(connectionState));
            else
                Transport.HandleClientConnectionState(new ClientConnectionStateArgs(connectionState));
        }
        #endregion

        #region Protected.
        /// <summary>
        /// Transport controlling this socket.
        /// </summary>
        protected Transport Transport = null;
        #endregion


        /// <summary>
        /// Sends data to connectionId.
        /// </summary>
        internal void Send(ref Queue<Packet> queue, byte channelId, ArraySegment<byte> segment, int connectionId)
        {
            if (GetConnectionState() != LocalConnectionStates.Started)
                return;

            //ConnectionId isn't used from client to server.
            Packet outgoing = new Packet(connectionId, segment, channelId);
            queue.Enqueue(outgoing);
        }

        /// <summary>
        /// Clears a queue using Packet type.
        /// </summary>
        /// <param name="queue"></param>
        internal void ClearPacketQueue(ref Queue<Packet> queue)
        {
            int count = queue.Count;
            for (int i = 0; i < count; i++)
            {
                Packet p = queue.Dequeue();
                p.Dispose();
            }
        }

        /// <summary>
        /// Adds channel to the end of the data.
        /// </summary>
        internal void AddChannel(ref Packet packet)
        {
            int writePosition = packet.Length;
            byte[] array = packet.Data;
            int dataLength = packet.Data.Length;
            //Need to resize to fit channel write. This will virtually never happen.
            if (dataLength < writePosition)
                Array.Resize(ref array, dataLength + 1);

            array[writePosition] = (byte)packet.Channel;
            packet.Length += 1;
        }

        /// <summary>
        /// Removes the channel, outputting it and returning a new ArraySegment.
        /// </summary>
        internal ArraySegment<byte> RemoveChannel(ArraySegment<byte> segment, out Channel channel)
        {
            byte[] array = segment.Array;
            int count = segment.Count;

            channel = (Channel)array[count - 1];
            return new ArraySegment<byte>(array, 0, count - 1);
        }

    }

}