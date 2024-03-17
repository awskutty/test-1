/*
@Api_Name         : /Add Content,
@Description      : To save attachments in DB and solr against the transaction
@Last_Error_code  : ERR-RES-70305
*/

// Require dependencies
var reqExpress = require('express');
var async = require('async');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var path = require('path');
var reqCommon = require('./helper/Common');
var router = reqExpress.Router();

var session_info = '';
var strServiceName = 'AddContent';

// Global variable initialization
var mResClient = '';
var strResult = '';
var strMessage = '';

// Host the api to server
router.post('/AddContent', function (appRequest, appResponse) {

  try {
    appRequest.body.PARAMS = appRequest.body;
    reqLogInfo.AssignLogInfoDetail(appRequest, function (pobjLogInfo, psession_info) {
      try {
        session_info = psession_info;
        var objLogInfo = pobjLogInfo;
        var pHeaders = appRequest.headers;

        // Handle the close event when client closes the api request
        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });
        objLogInfo.HANDLER_CODE = 'ADD_CONTENT';
        _PrintInfo('Begin');

        reqDBInstance.GetFXDBConnection(pHeaders, 'res_cas', objLogInfo, function (pClient) {
          try {
            var params = appRequest.body;
            var Fileparams = appRequest.files;
            var RelativePath = '';
            var FILE_NAME = '';
            var extension = '';
            var literName = '';
            SaveAddContentFiles();

            //save Attachments to DB - trna_data table
            function SaveAddContentFiles() {
              try {
                var FileCount = Object.keys(Fileparams).length;
                var StrRsParams = params.RSPARAMS;
                var strAppId = session_info.APP_ID;
                var count = 0;
                var AttachmentDetails = new SaveAttachmentDetails;

                AttachmentDetails = JSON.parse(StrRsParams).Items;
                var arrCount = AttachmentDetails.length;
                _PrintInfo("Attachment Details Length is " + arrCount);

                async.forEachOf(AttachmentDetails, function (value, key, asyncallback) {
                  var atmt = AttachmentDetails[key];

                  RelativePath = atmt.RELATIVE_PATH;
                  var Atcode = atmt.AT_CODE;
                  FILE_NAME = atmt.FILE_NAME;
                  extension = path.extname(atmt.FILE_NAME);
                  literName = path.basename(atmt.FILE_NAME, extension);
                  var bytedata = '';
                  for (var i = 0; i < FileCount; i++) {
                    if (atmt.FILE_NAME == Object.keys(Fileparams)[i])
                      bytedata = Fileparams[Object.keys(Fileparams)[i]].data;
                  }
                  var arr = [];
                  var row = new Object();
                  row.TRNAD_ID = '';//UUID
                  row.RELATIVE_PATH = RelativePath.toUpperCase().trim();//string
                  row.TENANT_ID = objLogInfo.TENANT_ID;//string
                  row.APP_ID = objLogInfo.APP_ID;
                  row.created_by = objLogInfo.USER_ID;//string
                  row.created_by_name = objLogInfo.LOGIN_NAME;//string
                  row.created_by_sessionid = objLogInfo.SESSION_ID;//string
                  row.created_clientip = objLogInfo.CLIENTIP;//string
                  row.created_tz = objLogInfo.CLIENTTZ;//string
                  row.created_tz_offset = objLogInfo.CLIENTTZ_OFFSET;//string
                  row.created_date_utc = reqDateFormatter.GetCurrentDateInUTC(pHeaders, objLogInfo);//date
                  row.created_date = reqDateFormatter.GetTenantCurrentDate(pHeaders, objLogInfo);//date
                  if (Atcode != "" && Atcode.toUpperCase() == "IMG") {
                    var TextData = new Buffer.from(bytedata).toString('base64');
                    row.TEXT_DATA = TextData;
                    var dataType = ['UUID', 'string', 'string', 'string', 'string', 'string', 'string', 'string', 'string', 'string', 'date', 'date', 'string'];
                    arr.push(row);
                    _PrintInfo("Started inserting records to TRNA_DATA");
                    reqDBInstance.InsertFXDB(pClient, 'TRNA_DATA', arr, objLogInfo, function (error) {
                      count = count + 1;
                      if (error) {
                        reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-RES-70301', 'Error In TRNA_DATA INSERT', error);
                      } else {
                        _PrintInfo('Tran insert success');
                        solrinsert(atmt, literName);
                        strResult = "SUCCESS";
                        asyncallback();
                      }
                    }, dataType);
                  } else {
                    row.BYTE_DATA = bytedata;
                    var dataType = ['UUID', 'string', 'string', 'string', 'string', 'string', 'string', 'string', 'string', 'string', 'date', 'date', 'blob'];
                    arr.push(row);
                    _PrintInfo("Started inserting records to TRNA_DATA");
                    if (pClient.DBConn && pClient.DBConn.DBType && pClient.DBConn.DBType.toLowerCase() == 'oracledb') {
                      var reqTorusRdbms = require('../../../../torus-references/instance/db/TorusRdbms');
                      var trna_procedure = 'SP_PDF_DATA_PROCESSING';
                      var bindParams = {
                        pUID: {
                          dir: reqTorusRdbms.direction.BIND_IN,
                          type: reqTorusRdbms.type.STRING,
                          val: reqCommon.Guid()
                        },
                        pRELATIVEPATH: {
                          dir: reqTorusRdbms.direction.BIND_IN,
                          type: reqTorusRdbms.type.STRING,
                          val: row.RELATIVE_PATH
                        },
                        pDATA: {
                          dir: reqTorusRdbms.direction.BIND_IN,
                          type: reqTorusRdbms.type.BUFFER,
                          val: row.BYTE_DATA
                        },

                      };
                      reqTranDBInstance.ExecuteProcedure(pClient, trna_procedure, bindParams, objLogInfo, function (error, result) {
                        count = count + 1;
                        if (error) {
                          reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-RES-70302', 'Error In TRNA_DATA INSERT', error);
                        } else {
                          _PrintInfo('Tran insert success');
                          solrinsert(atmt, literName);
                          strResult = "SUCCESS";
                          asyncallback();
                        }
                      });
                    } else {
                      reqDBInstance.InsertFXDB(pClient, 'TRNA_DATA', arr, objLogInfo, function (error) {
                        count = count + 1;
                        if (error) {
                          reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-RES-70302', 'Error In TRNA_DATA INSERT', error);
                        } else {
                          _PrintInfo('Tran insert success');
                          solrinsert(atmt, literName);
                          strResult = "SUCCESS";
                          asyncallback();
                        }

                      }, dataType);
                    }
                  }
                }, function (error) {
                  if (!error) {
                    successcallback();
                  } else {
                    reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-RES-70305', 'Error In Async foreach', error);
                  }
                });
              } catch (error) {
                reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-RES-70303', 'Error In SaveAddContentFiles Detail', error);
              }

              //Save Attachments in Solr
              function solrinsert(atmt) {
                //For Solr Index
                var param = {
                  ContentStream: '',
                  pFilename: atmt.FILE_NAME,
                  DT_CODE: params.DT_CODE,
                  DTT_CODE: params.DTT_CODE,
                  relative_path: RelativePath,
                  literName: literName
                };
              }
              //Success Callback
              function successcallback() {
                if (arrCount === count) {
                  reqInstanceHelper.SendResponse(strServiceName, appResponse, strResult, objLogInfo, null, null, null);
                }
              }
            }


            function SaveAttachmentDetails() {
              this.RELATIVE_PATH = "";
              this.FILE_NAME = "";
              this.FILE_SIZE = "";
              this.RS_PATH = "";
              this.RS_CODE = "";
              this.TRN_ID = 0;
              this.DTT_CODE = "";
              this.ATMT_DTT_CODE = "";
              this.DTTA_ID = 0;
              this.DTTAD_ID = 0;
              this.DTTADIF_ID = 0;
              this.AT_CODE = "";

            }
          } catch (error) {
            reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-RES-70306', 'Error in reqDBInstance.GetFXDBConnection callback', error);
          }
        });
        function _PrintInfo(pMessage) {
          reqInstanceHelper.PrintInfo(strServiceName, pMessage, objLogInfo);
        }
      } catch (error) {
        reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-RES-70307', 'Error In AssignLogInfo Detail', error);
      }
    });
  } catch (error) {
    reqInstanceHelper.SendResponse(strServiceName, appResponse, null, {}, 'ERR-RES-70304', 'Error In AssignLogInfo Detail', error);
  }
});


module.exports = router;
/*********** End of Service **********/