/*
@Api_Name : /SaveAttachment,
@Description : Save the scanned attachments
@Error_Code : ERR-SCN-80007
*/

// Require dependencies

var reqExpress = require('express');
var router = reqExpress.Router();
var reqAddContent = require('./helper/AddContent');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo')
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqSaveContent = require('../../../../torus-references/transaction/SaveContent');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var request = require('request');
var modPath = '../../../../node_modules/'
var path = require(modPath + 'path');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');


var PDFDocument = require('pdfkit');
var fs = require('fs');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper')
var strServiceName = 'SaveAttachment';
1
var mClient;
var stsResult = '';
var mTranDB;
var strOrm = 'knex';
var resdttjson = '';
var resarrstrparams = '';
// Host api to server
router.post('/SaveAttachment', function (appRequest, appResponse) {
    reqLogInfo.AssignLogInfoDetail(appRequest, function (pLogInfo, session_info) {
        var strInputParamJson = '';
        //  var ImageDatta = '';
        //ImageDatta = "";
        //strInputParamJson = appRequest.body
        var resultbody = appRequest.body.FILE_DETAILS;
        strInputParamJson = JSON.parse(resultbody);
        var pDTT_code = strInputParamJson.DTT_CODE;
        var strReqHeader = appRequest.headers
        var resultimgdata = appRequest.body.IMAGE_DATA;
        //var resultimgdata = ImageDatta;
        var strAppId = strInputParamJson.APP_ID;
        var pdfattachfiles = strInputParamJson.PDFATTACH_files;
        var arrimg = resultimgdata.split('!')
        var arrAtmts = [];
        var pdfstatus = strInputParamJson.PDF_STATUS;
        var ocrapi = strInputParamJson.OCRAPI;
        console.log(ocrapi);
        var objLogInfo = pLogInfo;
        _PrintInfo(objLogInfo, 'SaveAttachment Begin');
        objLogInfo.HANDLER_CODE = 'SAVE_ATTACHMENT';
        strInputParamJson.objLogInfo = objLogInfo;
        // Cassandra initialization
        reqDBInstance.GetFXDBConnection(strReqHeader, 'dep_cas', objLogInfo, function Callback_GetCassandraConn(mClient) {
            var conddtt = new Object();
            conddtt.app_id = strAppId;
            conddtt.dtt_code = pDTT_code;
            reqDBInstance.GetTableFromFXDB(mClient, 'DTT_INFO', ['dtt_dfd_json'], conddtt, objLogInfo, function (err, pResult) {
                if (err)
                    _PrintError(objLogInfo, "ERR-SCN-80001", err);
                else {
                    _PrintInfo(objLogInfo, 'PDF_STATUS - '+ pdfstatus);
                    if (pdfstatus == '') {
                        if (pResult.rows.length == 0) {
                            reqLogWriter.TraceError(objLogInfo, "key_column not found", "ERR-SCN-80002");
                        } else {
                            var arrjsonparam = [];
                            var strdetailjson = '';
                            try {
                                for (var i = 0; i < pResult.rows.length; i++) {
                                    strdetailjson = pResult.rows[i].dtt_dfd_json
                                }
                                strdetailjson = strdetailjson.replace(/\\/g, "");
                                resdttjson = JSON.parse(strdetailjson);
                                var dtresult = resdttjson.DATA_FORMATS;
                                for (var j = 0; j < dtresult.length; j++) {
                                    var dtdetails = dtresult[j].DF_DETAILS;
                                    for (var k = 0; k < dtdetails.length; k++) {
                                        var strparams = {};
                                        var targetcolumn = dtdetails[k].TARGET_COLUMN
                                        var datatype = dtdetails[k].DATA_TYPE
                                        var FIELD_COORDINATES = dtdetails[k].DF_UI.FIELD_COORDINATES
                                        var DATA_LENGTH = dtdetails[k].DATA_LENGTH
                                        if (targetcolumn != '') {
                                            if (FIELD_COORDINATES != '') {
                                                try {
                                                    strparams.targetcolumn = targetcolumn;
                                                    strparams.FIELD_COORDINATES = FIELD_COORDINATES;
                                                    strparams.datatype = datatype;
                                                    strparams.DATA_LENGTH = DATA_LENGTH;
                                                    arrjsonparam.push(strparams);
                                                } catch (error) {
                                                    _PrintError(objLogInfo, "ERR-SCN-80003", "Error in targetcolumn and FIELD_COORDINATES result" + error)
                                                }
                                            }
                                        }
                                    }

                                }
                                resarrstrparams = JSON.stringify(arrjsonparam);
                            } catch (error) {
                                _PrintError(objLogInfo, "ERR-SCN-80004", "Error in dtt_details_json result" + error)
                            }
                        }
                    }
                }
                if (pdfstatus == 'INPROCESS') {
                    for (var i in arrimg) {
                        var tmpArray = arrimg[i].split('~')
                        var FILE_NAME = tmpArray[0];
                        var BYTE_DATA = tmpArray[1];
                        var AT_CODE = 'IMG';
                        _PrintInfo(objLogInfo, 'FILE_NAME - ' + FILE_NAME);
                        fs.writeFile(__dirname + '/images/' + FILE_NAME.toUpperCase(), BYTE_DATA, 'base64', function (err) {
                            _PrintError(objLogInfo, "ERR-SCN-80005", err);
                        });
                    }
                    reqLogWriter.EventUpdate(objLogInfo);
                    appResponse.send('SUCCESS');
                } else if (pdfstatus == 'COMPLETED') {
                    var FILE_NAME = '';
                    var BYTE_DATA = '';
                    for (var i in arrimg) {
                        var tmpArray = arrimg[i].split('~')
                        FILE_NAME = tmpArray[0];
                        BYTE_DATA = tmpArray[1];
                        var AT_CODE = 'IMG';
                    }
                    console.log('pdfstatus');
                    console.log(pdfstatus);

                    CreateTempDir(__dirname, 'images', function (pStatus) {
                        if (pStatus == 'SUCCESS') {
                            fs.writeFile(__dirname + '/images/' + FILE_NAME.toUpperCase(), BYTE_DATA, 'base64', function (err) {
                                console.log(err);
                                var doc = new PDFDocument({
                                    compress: false
                                });
                                var pdffilename = __dirname + '/images/' + FILE_NAME + '.PDF';
                                var relativepath = FILE_NAME + '.PDF';
                                stream = doc.pipe(fs.createWriteStream(pdffilename));
                                var imagecount = 1;
                                var filelist = pdfattachfiles.split('!');

                                var contimage = pdfattachfiles.split('!').length;
                                contimage = contimage - 2;

                                for (var i in filelist) {
                                    var filename = filelist[i];
                                    if (filename != '') {
                                        doc.image(__dirname + '/images/' + filename.toUpperCase(), 50, 50, {
                                            width: 500,
                                            Height: 500,

                                        });

                                        if (imagecount <= contimage) {
                                            doc.addPage();
                                        }
                                        imagecount = imagecount + 1;
                                    }
                                }

                                doc.end();
                                stream.on('finish', function () {
                                    console.log('onfinishstart');
                                    var pdfbytedata;
                                    fs.readFile(pdffilename, function (err, data) {
                                        if (err) {
                                            throw err;
                                        }
                                        console.log('readFile completed.');
                                        pdfbytedata = data;

                                        var img = {};
                                        img.FILE_NAME = relativepath;
                                        img.RELATIVE_PATH = relativepath;
                                        console.log("relative_path=" & relativepath)
                                        img.BYTE_DATA = pdfbytedata;
                                        img.AT_CODE = 'PDF';
                                        arrAtmts.push(img);

                                        strInputParamJson.RSPARAMS.Items[0].RELATIVE_PATH = relativepath;
                                        strInputParamJson.RSPARAMS.Items[0].FILE_NAME = relativepath;
                                        strInputParamJson.RSPARAMS.Items[0].AT_CODE = 'PDF';

                                        saveprocess(function () {
                                            reqLogWriter.EventUpdate(objLogInfo);
                                            if (spcallback.STATUS == 'SUCCESS') {
                                                appResponse.send(spcallback);
                                            }
                                            else {
                                                appResponse.send(spcallback);
                                            }
                                        });

                                    });

                                });
                            });
                        }
                    });

                } else {
                    if (pdfstatus == '') {
                        for (var i in arrimg) {
                            var img = {};
                            var tmpArray = arrimg[i].split('~')
                            img.FILE_NAME = tmpArray[0];
                            img.RELATIVE_PATH = tmpArray[0];
                            console.log("relative_path=" & tmpArray[0])
                            img.BYTE_DATA = tmpArray[1];
                            var arrstrparams = [];
                            img.AT_CODE = 'IMG';
                            arrAtmts.push(img)
                        }
                    }
                    _PrintInfo(objLogInfo, 'Multiset_relativepath - ' + strInputParamJson.Multiset_relativepath);
                    if (strInputParamJson.Multiset_relativepath == '') {
                        if (ocrapi == '') {
                            saveprocess(function (spcallback) {
                                reqLogWriter.EventUpdate(objLogInfo);
                                if (spcallback.STATUS == 'SUCCESS') {
                                    appResponse.send(spcallback);
                                }
                                else {
                                    appResponse.send(spcallback);
                                }
                            });
                        } else {
                            ocrapiprocess(function (ocallback) {
                                reqLogWriter.EventUpdate(objLogInfo);
                                if (ocallback.STATUS == 'SUCCESS') {
                                    appResponse.send(ocallback);
                                }
                                else {
                                    appResponse.send(ocallback);
                                }
                            });
                        }
                    } else {
                        _PrintInfo(objLogInfo, 'Grouping_mode - ' + strInputParamJson.Grouping_mode);
                        if (strInputParamJson.Grouping_mode == 'SINGLE_SET') {
                            //if (strInputParamJson.Grouping_mode == 'SINGLE_SET' || strInputParamJson.Grouping_mode == 'MULTI_SET') {
                                
                                reqTranDBInstance.GetTranDBConn(appRequest.headers, false, function (pSession) {
                                    mTranDB = pSession;
                                    var Cond = strInputParamJson.Multiset_relativepath;
                                    var query = "select trn_id from trn_attachments where relative_path='" + Cond + "'";
                                    reqTranDBInstance.ExecuteSQLQuery(mTranDB, query, objLogInfo, function (pRes, pErr) {
                                        if (pRes.rows.length > 0) {
                                            var Trn_id_value = pRes.rows[0].trn_id;
                                            strInputParamJson.RSPARAMS.Items[0].TRN_ID = Trn_id_value;
                                            _PrintInfo(objLogInfo, 'OCRAPI - ' + ocrapi);
                                        if (ocrapi == '') {
                                            saveprocess(function (spcallback) {
                                                reqLogWriter.EventUpdate(objLogInfo);
                                                if (spcallback.STATUS == 'SUCCESS') {
                                                    appResponse.send(spcallback);
                                                }
                                                else {
                                                    appResponse.send(spcallback);
                                                }
                                            });

                                        } else {
                                            ocrapiprocess(function (ocallback) {
                                                reqLogWriter.EventUpdate(objLogInfo);
                                                if (ocallback.STATUS == 'SUCCESS') {
                                                    appResponse.send(ocallback);
                                                }
                                                else {
                                                    appResponse.send(ocallback);
                                                }
                                            });
                                        }

                                    }
                                });
                            });
                        } else {
                            if (ocrapi == '') {
                                saveprocess(function (spcallback) {
                                    reqLogWriter.EventUpdate(objLogInfo);
                                    if (spcallback.STATUS == 'SUCCESS') {
                                        appResponse.send(spcallback);
                                    }
                                    else {
                                        appResponse.send(spcallback);
                                    }
                                });

                            } else {
                                ocrapiprocess(function (ocallback) {
                                    reqLogWriter.EventUpdate(objLogInfo);
                                    if (ocallback.STATUS == 'SUCCESS') {
                                        appResponse.send(ocallback);
                                    }
                                    else {
                                        appResponse.send(ocallback);
                                    }
                                });
                            }
                        }
                    }
                }

                function saveprocess(scallback) {
                    _PrintInfo(objLogInfo, 'Input Param Json - ' + strInputParamJson);
                    reqAddContent.SaveAddContentFiles(arrAtmts, appRequest, function CallbackAddcontent(pacResult) {
                        try {
                            _PrintInfo(objLogInfo, 'SaveAddContentFiles Result - ' + pacResult);
                            if (pacResult == 'SUCCESS') {
                                reqSaveContent.ScanSaveContent(strInputParamJson, appRequest, '', function callback(pResult) {
                                    _PrintInfo(objLogInfo, "Save content result - " + pResult.STATUS);
                                    if (pResult.STATUS == 'SUCCESS') {
                                        scallback(pResult);
                                    }
                                    else {
                                        _PrintInfo(objLogInfo, pResult.STATUS);
                                        scallback(pResult);
                                    }
                                })
                            }
                        } catch (error) {
                            _PrintError(objLogInfo, "ERR-SCN-80006", "Error in SaveAddContentFiles" + error)
                        }
                        //callback();
                    })
                }
                //ocr process
                function ocrapiprocess(ocallback) {

                    var options = {
                        url: ocrapi,
                        method: 'POST',
                        json: {
                            'bytedata': tmpArray[1],
                            "coordinatesJSON": resarrstrparams
                        },
                        headers: {
                            'content-type': 'application/json'
                        }
                    };
                    request(options, function (error, responseFromImagingService, responseBodyFromImagingService) {
                        if (error) {
                            console.log(error);
                            saveprocess(function (spcallback) {
                                reqLogWriter.EventUpdate(objLogInfo);
                                if (spcallback.STATUS == 'SUCCESS') {
                                    appResponse.send(spcallback);
                                }
                                else {
                                    appResponse.send(spcallback);
                                }
                            });
                        } else {
                            console.log(responseBodyFromImagingService);

                            reqAddContent.SaveAddContentFiles(arrAtmts, appRequest, function CallbackAddcontent(pResult) {
                                console.log(strInputParamJson);
                                try {
                                    _PrintInfo(objLogInfo, 'SaveAddContentFiles Result - ' + pResult);
                                    if (pResult == 'SUCCESS') {
                                        reqSaveContent.ScanSaveContent(strInputParamJson, appRequest, responseBodyFromImagingService, function callback(pResult) {
                                            _PrintInfo(objLogInfo, "Save content result - " + pResult.STATUS);
                                            if (pResult.STATUS == 'SUCCESS') {
                                                ocallback(pResult);
                                            }
                                            else {
                                                console.log(pResult.STATUS);
                                                ocallback(pResult);
                                            }
                                        })
                                    }
                                } catch (error) {
                                    _PrintError(objLogInfo, "ERR-SCN-80007", "Error in SaveAddContentFiles" + error)
                                }
                            })
                            //callback();
                        }
                    });
                }
            });
        });
    });

    // Common function to print log messages
    function _PrintInfo(pLogInfo,pMessage) {
        reqInstanceHelper.PrintInfo(strServiceName, pMessage, pLogInfo)
      }

    function _PrintError(pLogInfo, pErrcode, pMessage) {
        console.log(pMessage + " " + pErrcode);
        reqLogWriter.TraceError(pLogInfo, pMessage, pErrcode);
    }
    //Create folder function
    function CreateTempDir(Ppath, foldername, pcallback) {
        var dir = ''
        try {
            var dir = path.join(Ppath, foldername)
            if (!fs.existsSync(dir)) {
                fs.mkdir(dir, 1, function (err) {
                    if (!err) {
                        //_PrintInfo('Directory Created Successfully')
                        pcallback('SUCCESS')
                    }
                })
            } else
                pcallback('SUCCESS')
        } catch (error) {
            pcallback('FAILURE')
        }
    }
});

/* End of SaveAttachment */
module.exports = router;