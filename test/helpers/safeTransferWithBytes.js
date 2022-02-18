async function safeTransferWithBytes(
  contract,
  sender,
  from,
  to,
  tokenId,
  data
) {
  return await contract
    .connect(sender)
    ['safeTransferFrom(address,address,uint256,bytes)'](
      from,
      to,
      tokenId,
      data
    );
}

module.exports = safeTransferWithBytes;
