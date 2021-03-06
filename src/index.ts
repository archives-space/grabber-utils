// https://catalog.archives.gov/search?q=*:*&f.parentNaId=24617777&f.level=item&sort=naIdSort%20asc&f.fileFormat=image%2Fjpeg
import axios from "axios";
import * as fs from "fs";
import path from "path";
import { promises as fsPromises } from "fs";
import Promise from "bluebird";
import ora from "ora";
import prompt from "prompt";

import * as dotenv from "dotenv";

dotenv.config();

const url = "https://catalog.archives.gov/OpaAPI/media/";
const folder = process.env.FOLDER || "download";
const fileName = process.env.FILENAME || "file.json";

const timeoutRequest = process.env.TIMEOUT_REQUEST
  ? +process.env.TIMEOUT_REQUEST
  : 40000;

const cleanFolder = process.env.CLEAN_FOLDER
  ? process.env.CLEAN_FOLDER === "true"
  : false;

const concurrencyLimit = process.env.CONCURRENCY_LIMIT
  ? +process.env.CONCURRENCY_LIMIT
  : 6;

const urls: string[] = [];
const errorUrls: string[] = [];

const start = new Date();
const hrstart = process.hrtime();

interface OpaLine {
  naId: string;
  localIdentifier: string;
  title: string;
}

const CleanFolder = async () => {
  if (cleanFolder) {
    console.log("");
    console.log("Download folder cleanup ...");
    console.log("");
    await fsPromises.rmdir(path.resolve(__dirname, folder), {
      recursive: true,
    });
  }
  !fs.existsSync(path.resolve(__dirname, folder)) &&
    (await fsPromises.mkdir(path.resolve(__dirname, folder)));
};

const ParseJsonFile = async () => {
  if (!fs.existsSync(`./src/${fileName}`)) {
    console.log(`ERROR : JSON file ./src/${fileName} does not exist`);
    console.log("");
    process.exit(0);
  }
  const data = fs.readFileSync(`./src/${fileName}`, "utf-8");
  const json = JSON.parse(data);
  json.map((line: OpaLine, index: number) => {
    if (!line.naId || !line.localIdentifier || !line.title) {
      return;
    }

    if (line.localIdentifier.split(".").pop() === "jpg") {
      const titleTemp = line.title.split("-");
      const missionTemp = line.localIdentifier.split("-");
      const mission = missionTemp[0] + "-" + missionTemp[1];
      const title = titleTemp[1].replace("-", "");
      let imageUrl = `${url}${
        line.naId
      }/content/stillpix/255-esd/STS134_LAUNCH_AND_LANDING/${
        line.localIdentifier
      }`;
      urls.push(imageUrl);
    }
  });
};

const DownloadFile = (fileUrl: string, index: number) => {
  return new Promise((resolve) => {
    console.log(`Grabbing file ${index}/${urls.length}`)

    const fileName = path.basename(fileUrl);
  
    const localFilePath = path.resolve(__dirname, folder, fileName);
    if (fs.existsSync(localFilePath)) {
      console.log(`File ${index}/${urls.length} already exist, skipped`);
      return resolve(true);
    }
    // delete the tmp file
    if (fs.existsSync(localFilePath + '.tmp')) {
      fs.rmSync(localFilePath + '.tmp');
    }
    try {
      axios({
        method: "GET",
        url: fileUrl,
        responseType: "stream",
        timeout: timeoutRequest,
      }).then(async (response) => {
        const w = response.data.pipe(fs.createWriteStream(localFilePath + '.tmp'));
        w.on("finish", () => {
          fs.renameSync(localFilePath + '.tmp', localFilePath)
          console.log(
            `File ${index}/${urls.length} successfully downloaded`
          );
          return resolve(true);
        });
      });
    } catch (err) {
      console.log(err);
      errorUrls.push(fileUrl);
      console.log(`Error while downloading the file ${index}/${urls.length}`);
      return resolve(false);
    }
  })
};

const summary = async () => {
  // @ts-ignore
  const end = new Date() - start;
  const hrend = process.hrtime(hrstart);

  const downloadFolder = await fsPromises.readdir(
    path.resolve(__dirname, folder)
  );

  console.log("");
  ora().fail(`${errorUrls.length} images could not be downloaded`);
  ora().succeed(`${downloadFolder.length} images in ${folder} folder`);
  console.log("");
  console.log("Execution time: %dms", end);
  console.log("Execution time (hr): %ds %dms", hrend[0], hrend[1] / 1000000);
  console.log("");
  console.log("Bye, see you soon !");
  console.log("");
  process.exit(0);
};

const validationByUser = () => {
  const onErr = (error: Error) => {
    console.log(error);
    return 1;
  };

  console.log("-- Parameters:");
  console.log(`--     Filename     : ${fileName}`);
  console.log(`--     Folder       : ${folder}`);
  console.log(`--     Clean folder : ${cleanFolder ? "yes" : "no"}`);
  console.log(`--     Timeout      : ${timeoutRequest}`);
  console.log("");
  prompt.get(
    [
      {
        name: "proceed",
        required: true,
        message: "Settings are correct ?",
        conform: (proceed) => {
          return (
            proceed.toLocaleLowerCase() === "y" ||
            proceed.toLocaleLowerCase() === "n"
          );
        },
      },
    ],
    function (err, result) {
      if (err) {
        return onErr(err);
      }
      if (result.proceed === "Y" || result.proceed === "y") {
        startGrabber();
      } else {
        console.log("");
        console.log("Bye, see you soon !");
        console.log("");
        process.exit(0);
      }
    }
  );
};

const startGrabber = async () => {
  await CleanFolder();
  await ParseJsonFile();

  console.log(`${urls.length} images found, starting grabber ...`);
  console.log("");

  const fetchUrlAsync = ({ index, data }: any) => {
    return DownloadFile(data, index + 1);
  }
  const allPromise = Promise.map(
    urls.map((data, index) => ({ data, index })),
    fetchUrlAsync,
    { concurrency: 4 }
  );
  
  allPromise.then((allValues: any) => {
    console.log('All jobs completed!')
    
    summary();
    console.log(allValues)
  });
};

(async () => {
  prompt.start();

  console.log("");
  console.log("#### STARTING SCRIPT ###");
  console.log("");

  validationByUser();
  return;
})();
