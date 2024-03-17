// Status - > basic ftp does not gives the buffer while reading the pem file from the fTP serve, hence cant connect the ssh2 ftp without downloading the pem file to teh local


/**
 * @File_Name        : /FTPHelper,
 * @Description     : Used for FTP [File Transfer Protocol],
 * @Last_Error_Code : ERR-FTP-025
 */
var commonFile = require('../util/Common.js');
var dir_path = '../../../../../';
var basicFtp = require("basic-ftp");
var sftpClient = require('ssh2-sftp-client');
var reqInstanceHelper = require(dir_path + 'torus-references/common/InstanceHelper');
var reqFs = require('fs');
var path = require("path");
var serviceName = 'FTPHelper';
var async = require('async');
var reqLogWriter = require('../../../../../torus-references/log/trace/LogWriter');
const { Stats } = require('ssh2/lib/protocol/SFTP');
var logFilePath = 'api/exchange';
var FTPLogInfo = reqLogWriter.GetLogInfo('FTP_HELPER', 'FTP_PROCESS', 'FTP_HELPER_ACTION', logFilePath);
FTPLogInfo.FTP_ERROR = true;
FTPLogInfo.SERVICE_NAME = serviceName;

async function getFileList(reqObj, callback) {

  try {
    var fileListRetryCount;
    if (reqObj && reqObj.fileListRetryCount) {
      fileListRetryCount = reqObj.fileListRetryCount;
    } else if (reqObj) {
      fileListRetryCount = reqObj.fileListRetryCount = 1;
    }

    var objLogInfo = reqObj.log_info;
    var read_path = reqObj.FOLDERPATH;
    var gatewaytype = reqObj.gateway_type;
    print_info("Read Path - " + read_path, objLogInfo);

    var resObj = {};
    var fileList = [];

    GetFTPConnection(reqObj, objLogInfo, async function (error, FtpInstance1, FtpInstance2) {
      if (error) {
        print_info('Error While Getting File list From FTP - ' + error.message, objLogInfo);
        resObj.STATUS = "FAILURE";
        resObj.DATA = [];
        resObj.ERROR_OBJ = error.message;
        return callback(resObj);
      } else {
        try {
          print_info('Listing Files from ' + read_path + ' folder path', objLogInfo);
          fileList = await FtpInstance1.list(read_path);
          var finalList = [];

          for (var temp = 0; temp < fileList.length; temp++) {
            if ((gatewaytype == "SFTP" && fileList[temp].type == "-") || fileList[temp]['isFile']) {
              finalList.push(fileList[temp]);
            }
          }

          print_info('Returned Files - ' + finalList.length, objLogInfo);
          resObj.STATUS = "SUCCESS";
          resObj.DATA = finalList;
          return callback(resObj);
        } catch (error) {
          print_error('Error in file listing', 'ERR-FTP-024', error.stack, objLogInfo);
          resObj.STATUS = "FAILURE";
          resObj.DATA = [];
          resObj.ERROR_OBJ = error.message;
          return callback(resObj);
        }
      }
    });
  } catch (error) {
    print_info('Error While Getting File list From FTP - ' + error.message, objLogInfo);
    resObj.STATUS = "FAILURE";
    resObj.DATA = [];
    resObj.ERROR_OBJ = error.message;
    return callback(resObj);
  }
}

function removeSlashCharFrmString(pStrPath) {
  if (pStrPath && pStrPath[pStrPath.length - 1] == '\\') {
    return pStrPath.substring(0, pStrPath.lastIndexOf('\\'));
  } else {
    return pStrPath;
  }
}

async function CreateFTPFolder(params, CreateFTPFolderCB) {

  try {
    var connectObj = params.connectObj;
    var objLogInfo = params.objLogInfo;
    var folderName = params.folderName;

    GetFTPConnection(connectObj, objLogInfo, async function (error, FtpInstance1, FtpInstance2) {
      try {
        if (FtpInstance1) {
          if (connectObj.gateway_type == 'SFTP') {
            var dirExist;
            folderName = folderName.replace(/\/\//g, '/');
            dirExist = await FtpInstance1.exists(folderName);
            //If directory exists it returns 'd' otherwise it returns false 
            if (!dirExist) {
              await FtpInstance1.mkdir(folderName, true)
            }
          } else {
            await FtpInstance1.ensureDir(folderName);
          }
          CloseFTPConnection(connectObj.gateway_type, FtpInstance1, FtpInstance2, objLogInfo);
        }
      } catch (error) {
        print_info('Error in GetFTPConnection Callback - ' + error.stack, objLogInfo);
      } finally {
        CreateFTPFolderCB();
      }
    });
  } catch (error) {
    print_info('Error While Creating Folder in FTP - ' + error.stack, objLogInfo);
    CreateFTPFolderCB();
  }
}


function createFolder(folderName, gateway_config, objLogInfo) {
  return new Promise((resolve, reject) => {
    try {
      var ip = gateway_config.ip;
      var port = gateway_config.port;
      var username = gateway_config.username;
      var password = gateway_config.password;
      var privateKey = gateway_config.cert_file_name;
      var passphrase = gateway_config.passphrase;
      var gatewayType = gateway_config.gateway_type;

      var connectObj = {
        "ip": ip,
        "port": port,
        "username": username,
        "password": password,
        "privateKey": privateKey,
        "passphrase": passphrase,
        "gateway_type": gatewayType,
        "cert_file_name": gateway_config.cert_file_name,
        "cert_location_type": gateway_config.cert_location_type,
        "keystoresftpInfo": gateway_config.keystoresftpInfo
        // ,"secure":true
      }
      CreateFTPFolderReqObj = {};
      CreateFTPFolderReqObj.connectObj = connectObj;
      CreateFTPFolderReqObj.objLogInfo = objLogInfo;
      CreateFTPFolderReqObj.folderName = folderName;
      console.log("Sub folder creation setup |" + gateway_config.can_create_subfolder)
      if (gateway_config.can_create_subfolder == undefined || gateway_config.can_create_subfolder) {
        CreateFTPFolder(CreateFTPFolderReqObj, function (err) {
          if (!err) {
            console.log("CreateFTPFolder - SUCCESS")
            resolve("SUCCESS");
          }
        });
      } else {
        console.log("Sub folder not created");
        resolve("SUCCESS");
      }
    } catch (error) {
      reject(error);
    }
  });
}


async function MoveFTPFile(params, MoveFTPFileCB) {
  try {
    /*  params Should contains
     - connectObj
     - destPath
     - srcPath
     - file_name
     - objLogInfo
      */
    var objLogInfo = params.objLogInfo;
    var file_name = params.file_name;
    // Normal Case
    var destPath = params.destPath;
    var srcPath = params.srcPath;
    var FtpInstance1 = params.FtpInstance1;

    if (!params.isFromFTPFileDeleteProcess) {
      print_info('Source Path - ' + srcPath + ' Destination Path - ' + destPath, objLogInfo);
      try {
        if (params.can_create_subfolder == undefined || params.can_create_subfolder) {
          await FtpInstance1.rename(srcPath, destPath);
          print_info(file_name + ' File is Successfully Moved...', objLogInfo);
        }
        MoveFTPFileCB(true, null);
      } catch (error) {
        console.log(error, '===============');
        // message: "550 The system cannot find the file specified. "
        // message: "550 Cannot create a file when that file already exists. "
        if (error.message.toUpperCase().indexOf('ALREADY EXISTS') > -1) {
          print_info(file_name + ' File already existing in the Destination Folder...', objLogInfo);
          // Delete the Existing FTP File
          var ftpMethodName = 'remove';

          if (params.gateway_type == 'SFTP') {
            ftpMethodName = 'delete';
          }

          await FtpInstance1[`${ftpMethodName}`](destPath);

          print_info(file_name + ' File Removed from the Destination Folder...', objLogInfo);
          // Retrying to Move the FTP File After Delete Action
          return MoveFTPFile(params, MoveFTPFileCB);
        } else {
          print_info(file_name + ' File is Failed to Move...' + error, objLogInfo);
          MoveFTPFileCB(false, error.stack);
        }
      }
    } else {
      // Calling From ExgDeleteFTPFiles API with Action as Move
      // There is no control to find the File which is used in Download or Upload, so that trying to do the Operation for both Process
      // For Download
      var destPathForDownload = params.destPathForDownload;
      var srcPathForDownload = params.srcPathForDownload;
      // For Upload
      var destPathForUpload = params.destPathForUpload;
      var srcPathForUpload = params.srcPathForUpload;
      print_info('For Download Process - Source Path - ' + srcPathForDownload + ' Destination Path - ' + destPathForDownload, objLogInfo);
      try {
        print_info(file_name + ' Moving a File which may be Used in Download Prcoess', objLogInfo);
        await FtpInstance1.rename(srcPathForDownload, destPathForDownload);
        print_info(file_name + ' File is Successfully Moved...', objLogInfo);
      } catch (error) {
        print_info(file_name + ' Error While Moving a File which may be Used in Download Prcoess ' + error, objLogInfo);
      }
      print_info('For Upload Process - Source Path - ' + srcPathForUpload + ' Destination Path - ' + destPathForUpload, objLogInfo);
      try {
        print_info(file_name + ' Moving a File From Main FTP which may be Used in Upload Prcoess', objLogInfo);
        await FtpInstance1.rename(srcPathForUpload, destPathForUpload);
        print_info(file_name + ' File is Successfully Moved...', objLogInfo);

      } catch (error) {
        print_info(file_name + ' Error While Moving a File which may be Used in Upload Prcoess' + error, objLogInfo);
      }

      MoveFTPFileCB(true, null);
    }
  } catch (error) {
    print_info(file_name + ' File is Failed to Move...' + error, objLogInfo);
    MoveFTPFileCB(false, error.stack);
  }

}

function BasicFTPChangeFilePath(Files, gateway_config, objLogInfo) {
  return new Promise((resolve, reject) => {
    var status = {};
    var resObj = {};
    var totalFileCount = Files.length;


    var successFiles = [];
    var failedFiles = [];

    if (gateway_config.skipFileMovingProcess) {
      status['SuccessFiles'] = Files;
      status['FailedFiles'] = failedFiles;
      resObj = commonFile.prepareMethodResponse("SUCCESS", "Skipping the File Moving Process...", status, '', '', '', '', '');
      resolve(resObj);
    } else {
      print_info('changeFilePath method called ', objLogInfo);

      GetFTPConnection(gateway_config, objLogInfo, function (error, FtpInstance1, FtpInstance2) {
        async.forEachOfSeries(Files, (fileObj, key, callBackAsync) => {
          // print_info("From : " + fileObj.fromPath + fileObj.file_name + " To : " + fileObj.toPath + fileObj.file_name, objLogInfo);
          try {
            var MoveFTPFileReqObj = {};
            MoveFTPFileReqObj.objLogInfo = objLogInfo;
            MoveFTPFileReqObj.FtpInstance1 = FtpInstance1;
            MoveFTPFileReqObj.file_name = fileObj.file_name;
            MoveFTPFileReqObj.srcPath = fileObj.fromPath + fileObj.file_name;
            MoveFTPFileReqObj.destPath = fileObj.toPath + fileObj.file_name;
            MoveFTPFileReqObj.isFromFTPFileDeleteProcess = gateway_config.isFromFTPFileDeleteProcess;
            // For Download
            MoveFTPFileReqObj.srcPathForDownload = fileObj.srcPathForDownload + fileObj.file_name;
            MoveFTPFileReqObj.destPathForDownload = fileObj.destPathForDownload + fileObj.file_name;
            // For Upload
            MoveFTPFileReqObj.srcPathForUpload = fileObj.srcPathForUpload + fileObj.file_name;
            MoveFTPFileReqObj.destPathForUpload = fileObj.destPathForUpload + fileObj.file_name;
            MoveFTPFileReqObj.gateway_type = gateway_config.gateway_type;
            MoveFTPFileReqObj.can_create_subfolder = gateway_config.can_create_subfolder
            MoveFTPFile(MoveFTPFileReqObj, function (MoveFTPFileStatus, error) {
              if (MoveFTPFileStatus) {
                fileObj.error = '';
                successFiles.push(fileObj);
              } else {
                fileObj.error = error;
                failedFiles.push(fileObj);
              }
              callBackAsync();
            });
          } catch (error) {
            print_info(file_name + ' File is Not Moved..' + error, objLogInfo);
            failedFiles.push(fileObj.file_name);
            callBackAsync();
          }
        }
          , () => {
            // Destroying or Disconneting the FTP Connections If exist
            CloseFTPConnection(gateway_config.gateway_type, FtpInstance1, FtpInstance2, objLogInfo);
            print_info('Total files - ' + totalFileCount);
            print_info('Successfull renaming count - ' + successFiles.length);
            print_info('Failed to rename count - ' + failedFiles.length);
            print_info('changeFilePath method ended successfully', objLogInfo);

            status['SuccessFiles'] = successFiles;
            status['FailedFiles'] = failedFiles;
            resObj = commonFile.prepareMethodResponse("SUCCESS", "Files Moving Process Completed...", status, '', '', '', '', '');
            resolve(resObj);
          }
        )
      });
    }
  });
}

async function BasicFTPDownloadFileFrmFtpToLocal(ftpObj, fileObj, downloadFileFrmFtpToLocalCB) {
  try {
    var read_path = ftpObj.read_path;
    var FtpInstance1 = ftpObj.FtpInstance1;
    var FtpInstance2 = ftpObj.FtpInstance2;
    var filedownloadDestPath = ftpObj.writepath;
    var file_name = fileObj.name;
    var FtpFilePath = read_path + file_name;
    var downloadFilePath = filedownloadDestPath + file_name;
    var downResult = {};
    var objLogInfo = ftpObj.objLogInfo;
    print_info('File Name - ' + file_name + ', FTP File Path - ' + FtpFilePath + ', Download File Path - ' + downloadFilePath, objLogInfo);
    reqLogWriter.EventUpdate(objLogInfo);

    try {
      if (!ftpObj.IS_FILE_FROM_CLIENT) {
        print_info('Local File Path - ' + downloadFilePath + ', Remote File Path - ' + FtpFilePath, objLogInfo);
        await FtpInstance1.downloadTo(downloadFilePath, FtpFilePath); // Local Path, FTP Path
        if (FtpInstance2) {
          // filedownloadDestPath = '//Rabeesh//Download/';
          FtpFilePath = filedownloadDestPath + file_name;
          FtpFilePath = '//' + FtpFilePath;
          print_info('Storage Path Type - FTP, Local File Path - ' + downloadFilePath + ', Remote File Path - ' + FtpFilePath, objLogInfo);
          await FtpInstance2.uploadFrom(downloadFilePath, FtpFilePath);
          reqFs.unlinkSync(downloadFilePath);
        }
        print_info(file_name + ' File Successfully Downloaded', objLogInfo);
        fileObj.download_status = true;
        fileObj.error = null;
        fileObj.strInfo = 'File Downloaded Successfully...';
        downResult.status = true;
        downResult.error = '';
        downResult.strInfo = 'File Downloaded Successfully...';
      } else {
        if (fileObj.name in ftpObj.CLIENT_FILES) {
          await CreateClientFile(downloadFilePath, ftpObj.CLIENT_FILES[fileObj.name].data);
          print_info(file_name + ' Upload start', objLogInfo);

          var ftpMethodName = 'uploadFrom';

          if (ftpObj.gateway_type == 'SFTP') {
            ftpMethodName = 'fastPut';
          }

          await FtpInstance1[`${ftpMethodName}`](downloadFilePath, FtpFilePath); //  Local Path, FTP Path
          print_info(file_name + ' Upload End', objLogInfo);

          reqFs.unlinkSync(downloadFilePath);
          print_info(file_name + ' File Successfully Downloaded', objLogInfo);
          fileObj.download_status = true;
          fileObj.error = null;
          fileObj.strInfo = 'File Downloaded Successfully...';
          downResult.status = true;
          downResult.error = '';
          downResult.strInfo = 'File Downloaded Successfully...';
        } else {
          print_info('There is No File Content From Client Side for - ' + file_name, objLogInfo);
          fileObj.download_status = false;
          fileObj.error = 'There is No File Content From Client Side for - ' + file_name;
          fileObj.strInfo = fileObj.error;
          downResult.status = false;
          downResult.error = fileObj.error;
          downResult.strInfo = fileObj.error;
        }
      }
    }
    catch (err) {
      print_error('Catch Error While Downloading a ' + file_name + ' ' + err.stack, 'ERR-FTP-023', err, objLogInfo);
      fileObj.download_status = false;
      fileObj.error = err.stack;
      fileObj.strInfo = 'File Not Downloaded...';
      downResult.status = false;
      downResult.error = err.stack;
      downResult.strInfo = 'File Not Downloaded...';
    }
    downloadFileFrmFtpToLocalCB(downResult);
  } catch (error) {
    print_info('Catch Error in BasicFTPDownloadFileFrmFtpToLocal() While Downloading a ' + file_name + ' ' + error, objLogInfo);
    fileObj.download_status = false;
    fileObj.error = error.stack;
    fileObj.strInfo = 'File Not Downloaded...';
    downResult.status = false;
    downResult.error = error.stack;
    downResult.strInfo = 'File Not Downloaded...';
    downloadFileFrmFtpToLocalCB(downResult);
  }
}

function CreateClientFile(localPath, file_content_buffer) {
  return new Promise((resolve, reject) => {
    // reqFs.writeFile(localPath, Buffer.from(fileObj.file_content),
    reqFs.writeFile(localPath, file_content_buffer, //  Working
      // reqFs.writeFile(localPath, new Buffer.from(fileObj.file_content),'binary', // TypeError [ERR_INVALID_ARG_TYPE] [ERR_INVALID_ARG_TYPE]: The first argument must be of type string or an instance of Buffer, ArrayBuffer, or Array or an Array-like Object. Received an instance of Object
      (err) => {
        if (err) {
          console.log(err);
          reject(err);
        } else {
          console.log('The file has been saved!');
          resolve('File Created');
        }
      });
  });
}

function downloadFromFTP(fileList, reqObj, addon, callbackFromFTP) {
  try {
    var status = {};
    var successFiles = [];
    var failedFiles = [];
    var objLogInfo = reqObj.log_info;
    var storagePath_gateway_config = reqObj.ftpTypeStoragePathInfo;
    var ftpObj = {};
    ftpObj.writepath = reqObj.storagePath;
    ftpObj.addonPath = addon;
    ftpObj.storagePath_gateway_config = storagePath_gateway_config;
    ftpObj.downldRetryCount = 1;
    // print_info("FTP Configuration Details - " + JSON.stringify(ftpObj), objLogInfo);
    print_info("FTP Type Storage Path Configuration Details - " + JSON.stringify(storagePath_gateway_config), objLogInfo);
    ftpObj.objLogInfo = objLogInfo;
    var read_path = reqObj.read_path;
    var resObj = {};
    print_info("Current Read Path - " + read_path, objLogInfo);
    if (addon) {
      //  Adding 'addon' str Parameter to the Read Path after removing slash character at the end of the Read Path
      read_path = removeSlashCharFrmString(read_path) + addon + '\\';
      print_info("Updated Read Path - " + read_path, objLogInfo);
    }
    ftpObj.read_path = read_path;
    GetFTPConnection(reqObj, objLogInfo, function (error, FtpInstance1, FtpInstance2) {

      async.forEachOfSeries(fileList, function (fileObj, key, downloadAsynCB) {
        if (error || !FtpInstance1 && !FtpInstance2) {
          fileObj.error = error;
          fileObj.strInfo = 'Error While getting FTP Connection...';
          failedFiles.push(fileObj);
          downloadAsynCB();
        } else {
          ftpObj.FtpInstance1 = FtpInstance1;
          ftpObj.FtpInstance2 = FtpInstance2;
          ftpObj.IS_FILE_FROM_CLIENT = reqObj.IS_FILE_FROM_CLIENT;
          ftpObj.CLIENT_FILES = reqObj.CLIENT_FILES;
          ftpObj.gateway_type = reqObj.gateway_type;
          BasicFTPDownloadFileFrmFtpToLocal(ftpObj, fileObj, function (result) {
            if (result.status) {
              successFiles.push(fileObj);
            } else {
              failedFiles.push(fileObj);
            }
            downloadAsynCB();
          });
        }
      },
        function (error, result) {
          // Destroying or Disconneting the FTP Connections If exist

          CloseFTPConnection(ftpObj.gateway_type, FtpInstance1, FtpInstance2, objLogInfo);
          print_info('Total File Count - ' + fileList.length, objLogInfo);
          print_info('Successfully Processed File Count - ' + successFiles.length + '/' + fileList.length, objLogInfo);
          print_info('Download Failed File Count - ' + failedFiles.length, objLogInfo);
          print_info('FTP File Download Process Completed Successfully...', objLogInfo);
          print_info('Number of Files Processed - ' + fileList.length, objLogInfo);
          status['SuccessFiles'] = successFiles;
          status['FailedFiles'] = failedFiles;
          resObj = commonFile.prepareMethodResponse("SUCCESS", "Files Downloaded Successfully...", status, "", "", "", "", "");
          global.ht_exg_ftp_download_process.put('FTP_DOWNLOAD_IN_PROGRESS', false);
          callbackFromFTP(resObj);
        });
    });
  } catch (error) {
    print_error('Catch Error in downloadFromFTP()...', 'ERR-FTP-012', error.stack, objLogInfo);
    resObj = commonFile.prepareMethodResponse("SUCCESS", "Files Downloaded Successfully...", status, "", "", "", "", "");
    callbackFromFTP(resObj);
  }
}

async function GetFTPConnection(GetFTPConnectionReqObj, objLogInfo, GetFTPConnectionCB) {
  try {
    // var objLogInfo = GetFTPConnectionReqObj.log_info;
    var ftpInstance1 = '';
    var ftpInstance2 = '';
    var gateway_type = GetFTPConnectionReqObj.gateway_type;
    var storagePath_gateway_config = GetFTPConnectionReqObj.ftpTypeStoragePathInfo;

    var connectObj = {
      host: GetFTPConnectionReqObj.ip,
      port: GetFTPConnectionReqObj.port,
      password: GetFTPConnectionReqObj.password
      // ,secure: true
    }

    if (gateway_type == 'SFTP') {
      ftpInstance1 = new sftpClient();
      connectObj.username = GetFTPConnectionReqObj.username;
      connectObj.passphrase = GetFTPConnectionReqObj.passphrase,
        console.log('Sftp Connection Configuration - ' + JSON.stringify(connectObj));
      console.log('Private key path - ' + GetFTPConnectionReqObj.cert_file_name);
      console.log('Cert Location Type - ' + GetFTPConnectionReqObj.cert_location_type);
      if (GetFTPConnectionReqObj.cert_file_name && GetFTPConnectionReqObj.cert_location_type) {
        if (GetFTPConnectionReqObj.cert_location_type.toUpperCase() == 'LOCAL') {
          connectObj.privateKey = reqFs.readFileSync(path.join(__dirname, '..', '..', GetFTPConnectionReqObj.cert_file_name));
        } else if (GetFTPConnectionReqObj.cert_location_type.toUpperCase() == 'SFTP') {
          var keystoresftpInfo = GetFTPConnectionReqObj.keystoresftpInfo;
          keystoresftpInfo.main_sftp_cert_file_name = GetFTPConnectionReqObj.cert_file_name;
          var privateKeyBuffer = await GetPrivatekeybuffer(keystoresftpInfo, objLogInfo);
          if (privateKeyBuffer) {
            connectObj.privateKey = privateKeyBuffer;
          }
        }
      }
      await ftpInstance1.connect(connectObj);
    } else {
      ftpInstance1 = new basicFtp.Client();
      connectObj.user = GetFTPConnectionReqObj.username;
      console.log('Ftp Connection Configuration- ' + JSON.stringify(connectObj));
      await ftpInstance1.access(connectObj);
    }
    if (storagePath_gateway_config) {
      connectObj = {
        host: storagePath_gateway_config.ip,
        port: storagePath_gateway_config.port,
        user: storagePath_gateway_config.username,
        password: storagePath_gateway_config.password
      };
      ftpInstance2 = new basicFtp.Client();
      await ftpInstance2.access(connectObj);
      if (GetFTPConnectionReqObj.storagePath) {
        await ftpInstance2.ensureDir(GetFTPConnectionReqObj.storagePath);
      }
    }
    return GetFTPConnectionCB(null, ftpInstance1, ftpInstance2);
  } catch (error) {
    print_info('Catch Error in GetFTPConnection()... ERR-FTP-018' + error.stack, objLogInfo);
    return GetFTPConnectionCB(error.message, null, null);
  }
}

async function CloseFTPConnection(gwType, FtpInstance1, FtpInstance2, objLogInfo) {
  try {
    var isClosed = 'closed';
    var ftpMethodName = 'close';
    if (gwType == 'SFTP') {
      ftpMethodName = 'end';
      isClosed = 'endCalled';
    }

    if (FtpInstance1 && !FtpInstance1[`${isClosed}`]) {
      FtpInstance1[`${ftpMethodName}`]();
    }
    if (FtpInstance2 && !FtpInstance2[`${isClosed}`]) {
      FtpInstance2[`${ftpMethodName}`]();
    }
    return;
  } catch (error) {
    print_error('Catch Error in CloseFTPConnection()...', 'ERR-FTP-022', error.stack, objLogInfo);
    return;
  }
}

async function GetPrivatekeybuffer(connectObj, objLogInfo) {
  try {
    return GetFTPConnection(connectObj, objLogInfo, async function (error, FtpInstance1, FtpInstance2) {

      if (error) {
        return '';
      } else {

        // var remotePath = 'privatekey/sftp_with_pass.pem';
        var pemFileBuffer = await FtpInstance1.get(connectObj.main_sftp_cert_file_name);
        console.log('Pem File Buffer - ' + pemFileBuffer);
        return pemFileBuffer;
      }
    });
  } catch (error) {
    print_error('Catch Error in GetPrivatekeybuffer()...', 'ERR-FTP-025', error.stack, objLogInfo);
    return '';
  }
}

async function uploadFileFrmLocalToFTP(ftpObj, file_name, uploadFileFrmLocalToFTPCB) {
  // Preparing Connection object for FTP
  var read_path = ftpObj.read_path;
  var write_path = ftpObj.writepath;
  var FtpInstance1 = ftpObj.FtpInstance1;
  var FtpInstance2 = ftpObj.FtpInstance2;
  var srcFilePath = read_path + file_name;
  var filedUploadDestPath = read_path + file_name;
  var ftpUploadFilePath = write_path + file_name;
  var uploadResult = {};
  var objLogInfo = ftpObj.objLogInfo;
  var storagePath_gateway_config = ftpObj.storagePath_gateway_config;
  print_info('File Name - ' + file_name + ', FTP File Path - ' + srcFilePath + ', Download File Path - ' + ftpUploadFilePath, objLogInfo);
  try {
    if (FtpInstance2) {
      // filedUploadDestPath = "D:\\exchange\\storage\\Upload\\" + file_name; // For Local Storage Path Type
      var DynamicFolderCreationReqObj = {};
      DynamicFolderCreationReqObj.destination_folder_path = read_path;
      DynamicFolderCreationReqObj.objLogInfo = objLogInfo;
      reqInstanceHelper.DynamicFolderCreation(DynamicFolderCreationReqObj);
      srcFilePath = '//' + srcFilePath;
      print_info('Storage Path Type - FTP, Local Download Path - ' + filedUploadDestPath + ', Remote File Path - ' + srcFilePath, objLogInfo);
      await FtpInstance2.downloadTo(filedUploadDestPath, srcFilePath); // local_Path,RemotePath
    }
    await FtpInstance1.uploadFrom(filedUploadDestPath, ftpUploadFilePath);// local_Path,RemotePath
    if (FtpInstance2) {
      reqFs.unlinkSync(filedUploadDestPath); // Removing Local File After the upload Process Completed
    }
    uploadResult.status = true;
    uploadResult.error = '';
    uploadResult.strInfo = 'File Uploaded Successfully...';
    uploadFileFrmLocalToFTPCB(uploadResult);
  } catch (error) {
    print_info('Error While Uploading a FTP File - ' + error.stack, objLogInfo);
    uploadResult.status = false;
    uploadResult.error = error.stack;
    uploadResult.strInfo = 'Error While Uploading a FTP File...';
    uploadFileFrmLocalToFTPCB(uploadResult);
  }
}

function uploadLocalToFTP(fileList, reqObj, read_path, callbackForUploadFTP) {
  try {
    var isAnySuccessFile = null;
    var isAnyFailsFile = null;
    var errorMsgForResp = '';
    var errorObjForResp = '';
    var successCount = 0;
    if (!fileList.length) {
      var objSuccessData = {
        strInfo: 'File List is Empty...',
        processedData: []
      };
      resObj = commonFile.prepareMethodResponse("FAILURE", '', objSuccessData, "ERR-FTP-011", 'File List is Empty...', '', '', '');
      callbackForUploadFTP(resObj);
    }
    if (reqObj && !reqObj.arrUploadFileList) {
      reqObj.arrUploadFileList = [];
    }
    var objLogInfo = reqObj.log_info;
    var gateway_config = JSON.parse(reqObj.gateway_config);
    var storagePath_gateway_config = reqObj.ftpTypeStoragePathInfo;

    var ftpObj = {};
    ftpObj.ip = gateway_config.ip;
    ftpObj.port = gateway_config.port;
    ftpObj.username = gateway_config.username;
    ftpObj.passphrase = gateway_config.passphrase;
    ftpObj.password = gateway_config.password;
    ftpObj.cert_file_name = gateway_config.cert_file_name;
    ftpObj.cert_location_type = gateway_config.cert_location_type;
    ftpObj.gateway_type = reqObj.gateway_type;
    ftpObj.read_path = read_path;
    ftpObj.writepath = reqObj.write_path;
    ftpObj.SKIP_FTP_DOWNLOAD = reqObj.SKIP_FTP_DOWNLOAD;
    ftpObj.ftpTypeStoragePathInfo = storagePath_gateway_config;
    ftpObj.keystoresftpInfo = reqObj.keystoresftpInfo;
    ftpObj.log_info = reqObj.log_info;

    //  print_info("FTP Configuration Details - " + JSON.stringify(ftpObj), objLogInfo);
    print_info("FTP Type Storage Path Configuration Details - " + JSON.stringify(storagePath_gateway_config), null);
    ftpObj.objLogInfo = objLogInfo;
    var resObj = {};
    GetFTPConnection(ftpObj, objLogInfo, function (error, FtpInstance1, FtpInstance2) {
      async.forEachOfSeries(fileList, function (fileObj, key, uploadAsynCB) {
        var objFile = {
          file_name: fileObj.file_name,
          exhf_id: fileObj.exhf_id
        };
        if (reqObj.SKIP_FTP_DOWNLOAD) { // Actually Skipping Upload Process
          var MoveFTPFileReqObj = {};
          MoveFTPFileReqObj.objLogInfo = objLogInfo;
          MoveFTPFileReqObj.FtpInstance1 = FtpInstance1;
          MoveFTPFileReqObj.file_name = fileObj.file_name;
          MoveFTPFileReqObj.srcPath = ftpObj.read_path + fileObj.file_name;
          MoveFTPFileReqObj.destPath = reqObj.write_path + fileObj.file_name;
          MoveFTPFileReqObj.gateway_type = reqObj.gateway_type;
          MoveFTPFileReqObj.can_create_subfolder = gateway_config.can_create_subfolder
          if (FtpInstance1) {
            MoveFTPFile(MoveFTPFileReqObj, function (status, error) {
              if (status) {
                isAnySuccessFile = true;
                objFile.error = null;
                successCount++;
              } else {
                isAnyFailsFile = true;
                objFile.error = error;
                errorObjForResp = error;
                errorMsgForResp = 'Error While Moving a File within the FTP';
              }
              reqObj.arrUploadFileList.push(objFile);
              uploadAsynCB();
            });
          } else {
            isAnyFailsFile = true;
            objFile.error = error;
            errorObjForResp = error;
            errorMsgForResp = 'Error While getting FTP Connection...';
            reqObj.arrUploadFileList.push(objFile);
            uploadAsynCB();
          }
        } else if (error || !FtpInstance1 && !FtpInstance2) {
          isAnyFailsFile = true;
          objFile.error = error;
          errorObjForResp = error;
          errorMsgForResp = 'Error While getting FTP Connection...';
          reqObj.arrUploadFileList.push(objFile);
          uploadAsynCB();
        } else {
          ftpObj.FtpInstance1 = FtpInstance1;
          ftpObj.FtpInstance2 = FtpInstance2;
          uploadFileFrmLocalToFTP(ftpObj, fileObj.file_name, function (result) {
            if (result.status) {
              isAnySuccessFile = true;
              objFile.error = null;
              successCount++;
            } else {
              isAnyFailsFile = true;
              objFile.error = result.error;
              errorObjForResp = result.error;
              errorMsgForResp = result.strInfo;
            }
            reqObj.arrUploadFileList.push(objFile);
            uploadAsynCB();
          });
        }
      },
        function (error, result) {
          // Destroying or Disconneting the FTP Connections If exist
          CloseFTPConnection(ftpObj.gateway_type, FtpInstance1, FtpInstance2, objLogInfo);
          print_info('Total File Count - ' + fileList.length, objLogInfo);
          print_info('Successfully Processed File Count - ' + successCount + '/' + fileList.length, objLogInfo);
          print_info('FTP File Upload Process Completed Successfully...', objLogInfo);
          print_info('Number of Files Processed - ' + fileList.length, objLogInfo);
          var strUploadInfo = '';
          if (isAnySuccessFile && isAnyFailsFile) {
            strUploadInfo = 'Files Uploaded Partially due to FTP Error...'
          } else if (isAnySuccessFile) {
            strUploadInfo = 'Files Uploaded Successfully...'
          } else if (isAnyFailsFile) {
            strUploadInfo = 'Files Upload Failed due to FTP Error...'
          }
          var objSuccessData = {
            strInfo: strUploadInfo,
            processedData: reqObj.arrUploadFileList
          };
          resObj = commonFile.prepareMethodResponse("SUCCESS", 'Selected Files Uploaded Successfully', objSuccessData, "", errorMsgForResp, errorObjForResp, "", "");
          callbackForUploadFTP(resObj);
        });
    });
  } catch (error) {
    var objSuccessData = {
      strInfo: 'Catch Error in uploadLocalToFTP()...',
      processedData: []
    };
    resObj = commonFile.prepareMethodResponse("FAILURE", '', objSuccessData, "ERR-FTP-013", 'Catch Error in uploadLocalToFTP()...', '', '', '');
    callbackForUploadFTP(resObj);
  }
}

async function DeleteFTPFile(params, DeleteFTPFileCB) {
  try {
    /*  params Should contains
     - FtpInstance1
     - FtpInstance2
     - deleteFromDownloadMainFTPFilePath
     - deleteFromUploadMainFTPFilePath
     - deleteFromDownloadSubFTPFilePath
     - deleteFromUploadSubFTPFilePath
     - deleteFromDownloadLinuxFilePath
     - deleteFromUploadLinuxFilePath
     - objLogInfo
     - file_name
      */
    var objLogInfo = params.objLogInfo;
    var file_name = params.file_name;
    var FtpInstance1 = params.FtpInstance1;
    var FtpInstance2 = params.FtpInstance2;
    var gatewaytype = params.gateway_type;
    var deleteFromDownloadMainFTPFilePath = params.deleteFromDownloadMainFTPFilePath;
    var deleteFromUploadMainFTPFilePath = params.deleteFromUploadMainFTPFilePath;

    var deleteFromDownloadSubFTPFilePath = params.deleteFromDownloadSubFTPFilePath;
    var deleteFromUploadSubFTPFilePath = params.deleteFromUploadSubFTPFilePath;

    var deleteFromDownloadLinuxFilePath = params.deleteFromDownloadLinuxFilePath;
    var deleteFromUploadLinuxFilePath = params.deleteFromUploadLinuxFilePath;
    var ftpMethodName = 'remove';

    try {
      if (gatewaytype == "SFTP") {
        ftpMethodName = 'delete';
      }
      if (deleteFromDownloadMainFTPFilePath) {
        try {
          print_info(file_name + ' Removing File From Main FTP in Download Prcoess', objLogInfo);
          await FtpInstance1[`${ftpMethodName}`](deleteFromDownloadMainFTPFilePath);
          print_info(file_name + 'File is Successfully Removed From Main FTP in Download Process.', objLogInfo);
        } catch (error) {
          print_info(file_name + 'Error While Removing File From Main FTP in Download Process - ' + error.message, objLogInfo);
        }
      }
      if (deleteFromUploadMainFTPFilePath) {
        try {
          print_info(file_name + ' Removing File From Main FTP in Upload Prcoess', objLogInfo);
          await FtpInstance1[`${ftpMethodName}`](deleteFromUploadMainFTPFilePath);
          print_info(file_name + 'File is Successfully Removed From Main FTP in Upload Process.', objLogInfo);
        } catch (error) {
          print_info(file_name + ' Error While Removing File From Main FTP in Upload Process - ' + error.message, objLogInfo);
        }
      }
      if (deleteFromDownloadSubFTPFilePath) {
        print_info(file_name + ' Removing File From Sub FTP in Download Process', objLogInfo);
        try {
          await FtpInstance1[`${ftpMethodName}`](deleteFromDownloadSubFTPFilePath);
          print_info(file_name + ' File is Successfully Removed From Sub FTP in Download Process', objLogInfo);
        } catch (error) {
          print_info(file_name + ' Error While Removing File From Sub FTP in Download Process - ' + error.message, objLogInfo);
        }
      }

      if (deleteFromUploadSubFTPFilePath) {
        print_info(file_name + ' Removing File From Sub FTP in Upload Process', objLogInfo);
        try {
          await FtpInstance1[`${ftpMethodName}`](deleteFromUploadSubFTPFilePath);
          print_info(file_name + ' File is Successfully Removed From Sub FTP in Upload Process', objLogInfo);
        } catch (error) {
          print_info(file_name + ' Error While Removing File From Sub FTP in Upload Process - ' + error.message, objLogInfo);
        }
      }

      if (deleteFromDownloadLinuxFilePath) {
        print_info(file_name + ' Removing File From Linux Path in Download Process', objLogInfo);
        try {
          reqFs.unlinkSync(deleteFromDownloadLinuxFilePath);
          print_info(file_name + ' File is Successfully Removed From Linux Path in Download Process', objLogInfo);
        } catch (error) {
          print_info(file_name + ' Error While Removing File From Linux Path in Download Process - ' + error.message, objLogInfo);
        }
      }

      if (deleteFromUploadLinuxFilePath) {
        print_info(file_name + ' Removing File From Linux Path in Upload Process', objLogInfo);
        try {
          reqFs.unlinkSync(deleteFromUploadLinuxFilePath);
          print_info(file_name + ' File is Successfully Removed From Linux Path in Upload Process', objLogInfo);
        } catch (error) {
          print_info(file_name + ' Error While Removing File From Linux Path in Upload Process - ' + error.message, objLogInfo);
        }
      }
      DeleteFTPFileCB(true, null);
    } catch (error) {
      print_info(file_name + ' File is Failed to Remove...' + error, objLogInfo);
      DeleteFTPFileCB(false, error.stack);
    }
  } catch (error) {
    print_info(file_name + ' File is Failed to Remove...' + error, objLogInfo);
    DeleteFTPFileCB(false, error.stack);
  }
}

function DeleteFTPFiles(Files, gateway_config, objLogInfo, DeleteFTPFilesCB) {
  try {
    var deleteFromDownloadMainFTPFileFolderPath = gateway_config.deleteFromDownloadMainFTPFileFolderPath;
    var deleteFromUploadMainFTPFileFolderPath = gateway_config.deleteFromUploadMainFTPFileFolderPath;
    var deleteFromUploadSubFTPFileFolderPath = gateway_config.deleteFromUploadSubFTPFileFolderPath;
    var deleteFromDownloadSubFTPFileFolderPath = gateway_config.deleteFromDownloadSubFTPFileFolderPath;
    var deleteFromUploadLinuxFileFolderPath = gateway_config.deleteFromUploadLinuxFileFolderPath; // Local path as FTP [used for Windows Service]
    var ftpTypeStoragePathInfo = gateway_config.ftpTypeStoragePathInfo;
    var deleteFromDownloadMainFTPFilePath = '';
    var deleteFromUploadMainFTPFilePath = '';
    var deleteFromDownloadSubFTPFilePath = '';
    var deleteFromUploadSubFTPFilePath = '';
    var deleteFromDownloadLinuxFilePath = '';
    var deleteFromUploadLinuxFilePath = '';
    var totalFileCount = Files.length;
    var successFiles = [];
    var failedFiles = [];
    var finalResponse = {};
    GetFTPConnection(gateway_config, objLogInfo, function (error, FtpInstance1, FtpInstance2) {
      if (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-FTP-019', 'Error While Getting FTP Connection...', error);
        failedFiles = Files;
        SendDeleteFTPFileResult(error);
      } else {
        async.forEachOfSeries(Files, (value, key, callBackAsync) => {
          if (deleteFromDownloadMainFTPFileFolderPath) {
            deleteFromDownloadMainFTPFilePath = deleteFromDownloadMainFTPFileFolderPath + value.file_name;
          }
          if (deleteFromUploadMainFTPFileFolderPath) {
            deleteFromUploadMainFTPFilePath = deleteFromUploadMainFTPFileFolderPath + value.file_name;
          }
          // Main FTP or Storage Path type as Sub FTP 
          if (deleteFromDownloadSubFTPFileFolderPath) {
            deleteFromDownloadSubFTPFilePath = deleteFromDownloadSubFTPFileFolderPath + value.file_name;
          }
          if (deleteFromUploadSubFTPFileFolderPath) {
            deleteFromUploadSubFTPFilePath = deleteFromUploadSubFTPFileFolderPath + value.file_name;
          }
          // Storage Path type as Local
          if (deleteFromDownloadSubFTPFileFolderPath) {
            deleteFromDownloadLinuxFilePath = deleteFromDownloadSubFTPFileFolderPath + value.file_name;
          }
          if (deleteFromUploadLinuxFileFolderPath) {
            deleteFromUploadLinuxFilePath = deleteFromUploadLinuxFileFolderPath + value.file_name;
          }
          print_info("File Name - " + value.file_name, objLogInfo);
          print_info("Delete From Main FTP in Download Process - " + deleteFromDownloadMainFTPFilePath, objLogInfo);
          print_info("Delete From Main FTP in Upload Process - " + deleteFromUploadMainFTPFilePath, objLogInfo);

          print_info("Delete From Sub FTP in Download Process - " + deleteFromDownloadSubFTPFilePath, objLogInfo);
          print_info("Delete From Sub FTP in Upload Process - " + deleteFromUploadSubFTPFilePath, objLogInfo);

          print_info("Delete From Linux Path in Download Process - " + deleteFromDownloadLinuxFilePath, objLogInfo);
          print_info("Delete From Linux Path in Upload Process - " + deleteFromUploadLinuxFilePath, objLogInfo);

          try {
            var DeleteFTPFileReqObj = {};
            DeleteFTPFileReqObj.objLogInfo = objLogInfo;
            DeleteFTPFileReqObj.file_name = value.file_name;
            DeleteFTPFileReqObj.FtpInstance1 = FtpInstance1;
            DeleteFTPFileReqObj.gateway_type = gateway_config.gateway_type;

            // Removing Main FTP File 
            DeleteFTPFileReqObj.deleteFromDownloadMainFTPFilePath = deleteFromDownloadMainFTPFilePath;
            DeleteFTPFileReqObj.deleteFromUploadMainFTPFilePath = deleteFromUploadMainFTPFilePath;
            // Removing Sub FTP File 
            DeleteFTPFileReqObj.FtpInstance2 = FtpInstance2;
            DeleteFTPFileReqObj.deleteFromDownloadSubFTPFilePath = deleteFromDownloadSubFTPFilePath;
            DeleteFTPFileReqObj.deleteFromUploadSubFTPFilePath = deleteFromUploadSubFTPFilePath;
            // Removing FTP File From Local Path [FTP Type For Windows Service]
            DeleteFTPFileReqObj.deleteFromDownloadLinuxFilePath = deleteFromDownloadLinuxFilePath;
            DeleteFTPFileReqObj.deleteFromUploadLinuxFilePath = deleteFromUploadLinuxFilePath;
            DeleteFTPFile(DeleteFTPFileReqObj, function (status) {
              if (status) {
                successFiles.push(value.file_name);
              } else {
                failedFiles.push(value.file_name);
              }
              callBackAsync();
            });
          } catch (error) {
            print_info(file_name + ' File is Not Moved..' + error, objLogInfo);
            failedFiles.push(value.file_name);
            callBackAsync();
          }
        }
          , () => {
            SendDeleteFTPFileResult();
          }
        )
      }

      function SendDeleteFTPFileResult(pError) {
        try {
          // Destroying or Disconneting the FTP Connections If exist
          CloseFTPConnection(gateway_config.gateway_type, FtpInstance1, FtpInstance2, objLogInfo);
          print_info('Total files - ' + totalFileCount);
          print_info('Successfull Files - ' + successFiles.length);
          print_info('Failed Files - ' + failedFiles.length);
          finalResponse.SucessFiles = successFiles;
          finalResponse.FailedFiles = failedFiles;
          DeleteFTPFilesCB(pError, finalResponse);
        } catch (error) {
          reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-FTP-020', 'Catch Error SendDeleteFTPFileResult()...', error);
          DeleteFTPFilesCB(error, null);
        }
      }
    });
  } catch (error) {
    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-FTP-020', 'Catch Error DeleteFTPFiles()...', error);
    DeleteFTPFilesCB(error, null);
  }
}


async function GetFTPFileBufferData(connectObj, fileName, objLogInfo) {
  try {
    return GetFTPConnection(connectObj, objLogInfo, async function (error, FtpInstance1, FtpInstance2) {

      if (error) {
        return '';
      } else {
        // var remotePath = 'privatekey/sftp_with_pass.pem';
        var filedataBuffer = await FtpInstance1.get(fileName);
        return filedataBuffer;
      }
    });
  } catch (error) {
    print_error('Catch Error in GetPrivatekeybuffer()...', 'ERR-FTP-025', error.stack, objLogInfo);
    return '';
  }
}

function print_info(pStr_mesg, pLogInfo) {
  reqInstanceHelper.PrintInfo(serviceName, pStr_mesg, pLogInfo);
}

function print_error(pErr_mesg, pErr_code, pError, pLogInfo) {
  reqInstanceHelper.PrintError(serviceName, pLogInfo, pErr_code, pErr_mesg, pError);
}

module.exports = {
  getFileList: getFileList,
  uploadLocalToFTP: uploadLocalToFTP,
  downloadFromFTP: downloadFromFTP,
  changeFilePath: BasicFTPChangeFilePath,
  createFolder: createFolder,
  RemoveSlashCharFrmString: removeSlashCharFrmString,
  DeleteFTPFiles: DeleteFTPFiles,
  GetFTPFileBufferData: GetFTPFileBufferData
}
