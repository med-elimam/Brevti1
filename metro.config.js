const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Fix for expo-sqlite web build
config.resolver.assetExts.push('wasm');

module.exports = config;
