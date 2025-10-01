import fs from "fs";
export const logger = new console.Console(fs.createWriteStream("./output.txt"));
// logger.log("hello world");
