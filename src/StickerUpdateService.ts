import {performGet} from "./RESTClient";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import {BACKGROUND_ASSETS_URL, VSCODE_ASSETS_URL} from "./ENV";
import {configDirectory, getTheme} from "./config";
import {Sticker} from "./themeTools";
import {createParentDirectories} from "./FileTools";

export interface DokiStickers {
  stickerDataURL: string;
  wallpaperURL: string;
}

export const attemptToUpdateSticker = async (): Promise<DokiStickers> => {
  const {
    sticker: {sticker: currentSticker},
  } = getTheme();
  const remoteStickerUrl = `${VSCODE_ASSETS_URL}${stickerPathToUrl(
    currentSticker
  )}`;
  const remoteWallpaperUrl = `${BACKGROUND_ASSETS_URL}${wallpaperPathToUrl(
    currentSticker
  )}`;
  const localStickerPath = resolveLocalStickerPath(currentSticker);
  const localWallpaperPath = resolveLocalWallpaperPath(currentSticker);
  await Promise.all([
    attemptToUpdateAsset(remoteStickerUrl, localStickerPath),
    attemptToUpdateAsset(remoteWallpaperUrl, localWallpaperPath),
  ]);

  return {
    stickerDataURL: createCssDokiAssetUrl(localStickerPath),
    wallpaperURL: createCssDokiAssetUrl(localWallpaperPath),
  };
};

async function attemptToUpdateAsset(
  remoteStickerUrl: string,
  localStickerPath: string,
) {
  if (await shouldDownloadNewAsset(remoteStickerUrl, localStickerPath)) {
    await installAsset(remoteStickerUrl, localStickerPath);
  }
}

const fetchRemoteChecksum = async (remoteAssetUrl: string) => {
  const checksumUrl = `${remoteAssetUrl}.checksum.txt`;
  console.log(`Fetching resource checksum: ${checksumUrl}`);
  const checkSumInputStream = await performGet(checksumUrl);
  return checkSumInputStream.setEncoding("utf8").read();
};

export const resolveLocalStickerPath = (currentSticker: Sticker): string => {
  const safeStickerPath = stickerPathToUrl(currentSticker);
  return path.join(configDirectory, "stickers", safeStickerPath);
};

export const resolveLocalWallpaperPath = (currentSticker: Sticker): string => {
  const safeStickerPath = wallpaperPathToUrl(currentSticker);
  return path.join(configDirectory, "wallpapers", safeStickerPath);
};

const createCssDokiAssetUrl = (localAssetPath: string): string => {
  return `file://${cleanPathToUrl(localAssetPath)}`;
};

function cleanPathToUrl(stickerPath: string) {
  const unEncodedUrl = stickerPath.replace(/\\/g, "/");
  const encodedUrl = encodeURI(unEncodedUrl).replace(/[!'()*]/g, escape);
  return encodedUrl;
}

function stickerPathToUrl(currentSticker: Sticker) {
  const stickerPath = currentSticker.path;
  return cleanPathToUrl(stickerPath);
}

function wallpaperPathToUrl(currentSticker: Sticker) {
  const stickerPath = `/` + currentSticker.name;
  return cleanPathToUrl(stickerPath);
}

function createChecksum(data: Buffer | string): string {
  return crypto.createHash("md5").update(data).digest("hex");
}

const calculateFileChecksum = (filePath: string): string => {
  const fileRead = fs.readFileSync(filePath);
  return createChecksum(fileRead);
};

const fetchLocalChecksum = async (localSticker: string) => {
  return fs.existsSync(localSticker)
    ? calculateFileChecksum(localSticker)
    : "File not downloaded, bruv.";
};

const shouldDownloadNewAsset = async (
  remoteAssetUrl: string,
  localStickerPath: string
): Promise<boolean> => {
  try {
    const remoteChecksum = await fetchRemoteChecksum(remoteAssetUrl);
    const localChecksum = await fetchLocalChecksum(localStickerPath);
    return remoteChecksum !== localChecksum;
  } catch (e) {
    console.error("Unable to check for updates", e);
    return false;
  }
};

const downloadRemoteAsset = async (
  remoteAssetUrl: string,
  localDestination: string
) => {
  createParentDirectories(localDestination);
  console.log(`Downloading remote asset: ${remoteAssetUrl}`);
  const stickerInputStream = await performGet(remoteAssetUrl);
  console.log("Remote asset Downloaded!");
  fs.writeFileSync(localDestination, stickerInputStream.read());
};

async function installAsset(
  remoteAssetUrl: string,
  localAssetPath: string
): Promise<boolean> {
  try {
    await downloadRemoteAsset(remoteAssetUrl, localAssetPath);
    return true;
  } catch (e) {
    console.error(`Unable to install asset ${remoteAssetUrl}!`, e);
  }
  return false;
}
