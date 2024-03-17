
/*
@Api_Name           : /DownloadLogDetails,
@Description        : To search the log data from Solr
@Last_Error_code    : ERR-AUT-14707
*/

// Require dependencies
var reqExpress = require('express');
var reqPath = require('path');
var router = reqExpress.Router();
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqLogviewerHelper = require('./helper/LogviewerHelper');

var serviceName = 'DownloadLogDetails';

router.get('/DownloadLogDetails', function (appRequest, appResponse) {
    try {
        var path = require('path');
        var fs = require('fs');
        var archiver = require('archiver');
        var params = JSON.parse(appRequest.query.PARAMS);
        var header = appRequest.headers;
        var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            try {
                var TraceLogCore = 'TRACE_LOG_CORE';
                if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                    TraceLogCore = 'DEBUG_LOG';
                }

                objLogInfo.HANDLER_CODE = 'DownloadLogDetails';
                objLogInfo.PROCESS = 'DownloadLogDetails-Authentication';
                objLogInfo.ACTION = 'DownloadLogDetails';

                // Handle the close event when client closes the api request
                appResponse.on('close', function () { });
                appResponse.on('finish', function () { });
                appResponse.on('end', function () { });

                reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);

                var searchCond = params.LOG_DETAILS;
                objLogInfo.TENANT_ID = params.TENANT_ID;
                var intRecordsPerPage = params.RECORDS_PER_PAGE;
                var intCurrentPage = params.PAGE_NO;

                reqLogviewerHelper.SolrLogSearch(header, TraceLogCore, searchCond, intRecordsPerPage, intCurrentPage, objLogInfo, function (error, result) {
                    try {
                        if (error) {
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'errcode', 'errmsg', error);
                        } else {
                            var strFilePath = '/temp/log.log';
                            var solrDocs = result.SolrDocs;
                            var logMessage = '';
                            if (solrDocs) {
                                for (var i = 0; i < solrDocs.length; i++) {
                                    logMessage = logMessage + solrDocs[i].MESSAGE;
                                }
                            } else {
                                logMessage = result;
                            }
                            strFilePath = reqPath.join(__dirname, strFilePath);
                            reqInstanceHelper.PrintInfo(serviceName, 'File Path - ' + strFilePath, objLogInfo);
                            saveFile(strFilePath, logMessage, function (error, result) {
                                try {
                                    if (error) {
                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-AUT-14707', 'Error While calling saveFile()...', error);
                                        appResponse.send(error);
                                    } else {
                                        appResponse.set('Content-Type', 'application/octet-stream');
                                        appResponse.download(path.resolve(result));
                                        reqInstanceHelper.PrintInfo(serviceName, 'End', objLogInfo);
                                        reqLogWriter.EventUpdate(objLogInfo);
                                    }
                                } catch (error) {
                                    reqInstanceHelper.SendResponse("FAILURE", '', '', '', "ERR-AUT-14701", "Exception occured while fetching data from TRACE_LOG_CORE", error);
                                }
                            });
                        }
                    } catch (error) {
                        reqInstanceHelper.SendResponse("FAILURE", '', '', '', "ERR-AUT-14702", "Exception occured while fetching data from TRACE_LOG_CORE", error);
                    }
                });

                function saveFile(filepath, data, callback) {
                    try {
                        var directoryName = path.dirname(filepath);
                        var maxSize = 1024 * 1024 * 5; //this is 5mb
                        var maxFiles = 3;
                        var fileExt = path.extname(filepath);
                        var fileName = path.basename(filepath, fileExt);
                        fs.readdir(directoryName, (error, files) => {
                            if (error) {
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-AUT-14706', 'Error While Reading this directory...', error);
                                callback(error);
                            } else {
                                if (files.length > 0) {
                                    for (var file of files) {
                                        fs.unlinkSync(path.join(directoryName, file));
                                    }
                                }
                                writeData();
                                function writeData() {
                                    var byteData = new Buffer.from(data);
                                    if (byteData.byteLength > maxSize) {
                                        var arrData = [];
                                        for (var i = 0; i < maxFiles; i++) {
                                            var newFilePath = directoryName + '/' + fileName + i + fileExt;
                                            var startSize = i * maxSize;
                                            var endSize = (i + 1) * maxSize;
                                            var fileObj = {
                                                path: newFilePath,
                                                data: byteData.toString('ascii', startSize, endSize)
                                            };
                                            if (fileObj.data) {
                                                arrData.push(fileObj);
                                            } else {
                                                break;
                                            }
                                        }
                                        var f = 0;
                                        if (arrData.length > f) {
                                            wirteMultiFile(arrData[f]);
                                        }
                                        function wirteMultiFile(fileObj) {
                                            f++;
                                            fs.writeFile(fileObj.path, fileObj.data, function (error) {
                                                if (error) {
                                                    callback(error);
                                                } else {
                                                    if (arrData.length > f) {
                                                        wirteMultiFile(arrData[f]);
                                                    } else {
                                                        generateZip();
                                                    }
                                                }
                                            });
                                        }
                                    } else {
                                        fs.writeFile(filepath, data, function (error) {
                                            if (error) {
                                                callback(error);
                                            } else {
                                                //generateZip();
                                                callback(null, filepath);
                                            }
                                        });
                                    }
                                }
                            }
                        });
                        function generateZip() {
                            var output = fs.createWriteStream('logs.zip');
                            var archive = archiver('zip');

                            output.on('close', function () {
                                callback(null, output.path);
                            });

                            archive.on('error', function (err) {
                                throw err;
                            });

                            archive.pipe(output);

                            archive.directory(directoryName + '/', false);

                            archive.finalize();
                        }
                    } catch (error) {
                        reqInstanceHelper.SendResponse("FAILURE", '', '', '', "ERR-AUT-14703", "Exception occured while saving data  and generate zip file", error);
                    }

                }
            } catch (error) {
                reqInstanceHelper.SendResponse("FAILURE", '', '', '', "ERR-AUT-14704", "Exception occured while fetching data from TRACE_LOG_CORE", error);
            }
        });
    } catch (error) {
        reqInstanceHelper.SendResponse("FAILURE", '', '', '', "ERR-AUT-14705", "Exception occured while fetching data from TRACE_LOG_CORE", error);
    }

});

module.exports = router;