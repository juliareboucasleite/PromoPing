const playCommand = require("./Play");

module.exports = {
  ...playCommand,
  name: "playlist",
  aliases: ["pl"],
  usage: "!playlist <link ou nome>",
  description: "Atalho de `play` para links e pesquisas de playlists.",
};
