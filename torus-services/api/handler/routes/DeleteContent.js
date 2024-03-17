/*
@Api_Name         : /DeleteContent,
@Description      : To deleting transaction attachments from TRNA and resource database,
@Last_Error_Code  : ERR-HAN-40511
*/

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqSrvHlpr = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLinq = require('node-linq').LINQ;
var reqSolrHelper = require('../../../../torus-references/instance/SolrInstance');

var serviceName = 'DeleteContent';

// Global variable initialization
var mDepCas, mCasIns, mTranDB = '';
var status = '';

var pHeaders = '';

// Host the api to server
router.post('/DeleteContent', function (appRequest, appResponse, next) {
  var objLogInfo = '';
  try {
    // Handle the api close event from when client close the request
    appResponse.on('close', function () {
      reqTranDBInstance.CallRollback(mTranDB);
    });
    appResponse.on('finish', function () { });
    appResponse.on('end', function () { });



    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
      objLogInfo.HANDLER_CODE = 'DELETE_CONTENT';
      reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
      pHeaders = appRequest.headers;
      reqInstanceHelper.PrintInfo(serviceName, 'Obtaining Dep_cas connection', objLogInfo);
      reqDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function CallbackGetCassandraConn(pClient) {
        mDepCas = pClient;
        reqInstanceHelper.PrintInfo(serviceName, 'Obtaining res_cas connection', objLogInfo);
        reqDBInstance.GetFXDBConnection(pHeaders, 'res_cas', objLogInfo, function CallbackGetCassandraConn(pClient_res) {
          mCasIns = pClient_res;
          reqInstanceHelper.PrintInfo(serviceName, 'Getting TranDB Connection', objLogInfo);
          reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
            mTranDB = pSession;

            var pJsonParams = appRequest.body.PARAMS.JSON_DATASET;
            var pAppId = objSessionInfo.APP_ID;
            var parsedjson = JSON.parse(pJsonParams);
            var pTrna_id = parsedjson[0]['trna_id'];
            var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
            var staticCore = "static_core";
            if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
              staticCore = "TRAN_ATMT_CONTENT";
            }

            reqInstanceHelper.PrintInfo(serviceName, 'Calling Delete content method', objLogInfo);
            deleteContent(pTrna_id, pAppId, objLogInfo, function (response) {
              var lstSelAttachment = [];
              reqSrvHlpr.ParseSelectedTran(lstSelAttachment, parsedjson, '', '');
              reqInstanceHelper.PrintInfo(serviceName, 'Calling Mail Framework', objLogInfo);
              reqSrvHlpr.SendMail(mDepCas, '', 'DELETE_CONTENT_TEMPLATE', lstSelAttachment, 'DELETE_CONTENT', objLogInfo, pHeaders, {
                SessionInfo: objSessionInfo
              }, function callbackSendDeleteContentMail(pStatus) {
                var resObj = {};
                if (response.STATUS === 'SUCCESS') {
                  reqInstanceHelper.SendResponse(serviceName, appResponse, 'SUCCESS', objLogInfo, null, null, null);
                } else {
                  reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, response.ERROR_CODE, response.ERROR_MESSAGE, response.ERROR_OBJECT);
                }
              });
            });
          });
        });
      });
    });
  } catch (ex) {
    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-40501', 'Exception occurs initially', ex);
  }



  function executeFXSelectQuery(casInst, pTableName, pColumns, pCond, callbackExecCassandra) {
    var resObj = {};
    try {
      reqDBInstance.GetTableFromFXDB(casInst, pTableName, pColumns, pCond, objLogInfo, function callback(pErr, pResult) {
        if (pErr) {
          resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-40508', 'Error while executing query in executeFXSelectQuery method', pErr);
          callbackExecCassandra(resObj);
        } else {
          resObj = sendMethodResponse('SUCCESS', '', pResult, '', '', '');
          callbackExecCassandra(resObj);
        }
      });
    } catch (ex) {
      resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-40509', 'Exception in executeFXSelectQuery method', ex);
      callbackExecCassandra(resObj);
    }
  }

  // Delete attachment from TRN_ATTACHMENTS  using TRNA_ID
  function deleteContent(pTrna_id, pAppId, objLogInfo, callBackDeleteContent) {
    try {
      var QUERY_GET_RELATIVE_PATH = 'select relative_path,dtt_code,dtta_id from trn_attachments where TRNA_ID = @TRNAID';
      var QUERY_DELETE_FROM_ATTACHMENTS = 'Delete from TRN_ATTACHMENTS where Trna_id = @TRNAID';

      QUERY_GET_RELATIVE_PATH = QUERY_GET_RELATIVE_PATH.replace(/@TRNAID/g, pTrna_id);
      reqInstanceHelper.PrintInfo(serviceName, 'Getting relative path from trn_attachments', objLogInfo);
      executeTranQuery(QUERY_GET_RELATIVE_PATH, objLogInfo, function (respRelativePathData) {
        if (respRelativePathData.STATUS === 'SUCCESS') {
          if (respRelativePathData.SUCCESS_DATA.rows.length > 0) {
            respRelativePathData = respRelativePathData.SUCCESS_DATA;
            var relative_path = respRelativePathData.rows[0]['relative_path'];
            reqInstanceHelper.PrintInfo(serviceName, 'Delete on Solr with params of - filename:' + relative_path, objLogInfo);
            __DeleteSolr(pAppId, respRelativePathData.rows, function callbackDeleteSolr(pStatus) {
              if (pStatus == 'SUCCESS') {
                reqInstanceHelper.PrintInfo(serviceName, 'Executing method _getTrnaIDFromRelativePath', objLogInfo);
                _getTrnaIDFromRelativePath(relative_path, function (respTran) {
                  if (respTran.STATUS === 'SUCCESS') {
                    if (respTran != undefined && respTran.SUCCESS_DATA.rows != undefined) {
                      respTran = respTran.SUCCESS_DATA;
                      if (respTran.rows.length > 0) {
                        var trnad_id = respTran.rows[0].trnad_id;
                        reqInstanceHelper.PrintInfo(serviceName, 'Calling _deleteTrnaData method', objLogInfo);
                        _deleteTrnaData(trnad_id, objLogInfo, function (respTrnaData) {
                          if (respTrnaData.STATUS === 'SUCCESS') {
                            QUERY_DELETE_FROM_ATTACHMENTS = QUERY_DELETE_FROM_ATTACHMENTS.replace(/@TRNAID/g, pTrna_id);
                            executeTranQuery(QUERY_DELETE_FROM_ATTACHMENTS, objLogInfo, function (resp) {
                              callBackDeleteContent(resp);
                            });
                          } else {
                            callBackDeleteContent(respTrnaData);
                          }
                        });
                      } else {
                        callBackDeleteContent(respTran);
                      }
                    } else {
                      var resObj = sendMethodResponse('SUCCESS', '', respTran, '', '', '', 'SUCCESS', 'No data found');
                      callBackDeleteContent(resObj);
                    }
                  } else {
                    callBackDeleteContent(respTran);
                  }
                });
              } else {
                var resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-40502', 'Exception occurs while deleting on SOLR ', null);
                callBackDeleteContent(resObj);
              }
            });
          } else {
            callBackDeleteContent(respRelativePathData);
          }
        } else {
          callBackDeleteContent(respRelativePathData);
        }
      });
    } catch (ex) {
      var resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-40502', 'Exception occurs while executing deleteContent method', ex);
      callBackDeleteContent(resObj);
    }
  }

  function __DeleteSolr(pAppId, pATMT, pCallback) {
    _NeedSolrIndex(pAppId, pATMT, function callback(ATMTIndex) {
      // Delete ATMT index on solr
      if (ATMTIndex.length > 0) {
        reqInstanceHelper.PrintInfo(serviceName, ' NEED_SOLR_INDEX : true ', objLogInfo);
        reqSolrHelper.SolrDelete(pHeaders, staticCore, 'filename', ATMTIndex, objLogInfo, function callbackDeleteATMTIndex(pStatus) {
          pCallback(pStatus);
        });
      } else
        pCallback('SUCCESS');
    });
  }

  // Check NeedSolr Index for DTT
  function _NeedSolrIndex(pAppId, pATMTInfo, pCallback) {
    var arrATMTIndex = [];
    var obj = {};
    try {
      reqDBInstance.GetTableFromFXDB(mDepCas, 'DTT_INFO', ['NEED_SOLR_INDEX', 'DTT_CODE', 'DTT_DFD_JSON'], {
        APP_ID: pAppId,
        DTT_CODE: pATMTInfo[0].dtt_code
      }, objLogInfo, function callbackDTTInfo(pError, pResult) {
        try {
          if (pError) {
            obj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-40502', 'Error on _NeedSolrIndex() function', pError);
            pCallback(arrATMTIndex, obj);
          } else {
            for (var i = 0; i < pResult.rows.length; i++) {
              var row = pResult.rows[i];
              // Add ATMT solr index property
              var blnNeedIndex = _GetAttachmentIndex(row['dtt_dfd_json'], pATMTInfo[0].dtta_id);
              if (blnNeedIndex)
                arrATMTIndex.push(pATMTInfo[0].relative_path);
            }
            obj = sendMethodResponse('SUCCESS', '', '', '', '', '');
            pCallback(arrATMTIndex, obj);
          }
        } catch (error) {
          obj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-40502', 'Error on _NeedSolrIndex() function', error);
          pCallback(arrATMTIndex, obj);
        }
      });
    } catch (error) {
      obj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-40502', 'Error on _NeedSolrIndex() function', error);
      pCallback(arrATMTIndex, obj);
    }
  }

  // Get ATMT index to delete atmt from SOLR (STATIC CORE)
  function _GetAttachmentIndex(pDttDfdJson, pDttaId) {
    try {
      var strDFDJSON = pDttDfdJson.replace(/\\/g, '');
      var objDFDJson = JSON.parse(strDFDJSON);
      if (objDFDJson.DTT_ATTACHMENT != null && objDFDJson.DTT_ATTACHMENT != undefined)
        var DTTA = new reqLinq(objDFDJson.DTT_ATTACHMENT).Where(function (i) {
          return i.DTTA_ID === pDttaId;
        }).ToArray();

      if (DTTA.length > 0) {
        if (DTTA[0].NEED_SOLR_INDEX != undefined && DTTA[0].NEED_SOLR_INDEX != null && DTTA[0].NEED_SOLR_INDEX != "" && DTTA[0].NEED_SOLR_INDEX == 'Y')
          return true;
        else
          return false;
      } else
        return false;
    } catch (error) {
      reqInstanceHelper.PrintError('', objLogInfo, 'ERR-HAN-40338', '_Error on GetAttachmentIndex() function ', error);

      return false;
    }
  }

  // Execute delete query in FX DB
  function executeFXDeleteQuery(casInst, pTableName, pCond, callbackExecCassandra) {
    var resObj = {};
    try {
      reqDBInstance.DeleteFXDB(casInst, pTableName, pCond, objLogInfo, function callback(pErr, pResult) {
        if (pErr) {
          resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-40510', 'Error occurs during deletion', pErr);
          callbackExecCassandra(resObj);
        } else {
          resObj = sendMethodResponse('SUCCESS', '', pResult, '', '', '');
          callbackExecCassandra(resObj);
        }
      });
    } catch (ex) {
      resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-40511', 'Exception occurs during execution of executeFXDeleteQuery method', ex);
      callbackExecCassandra(resObj);
    }
  }
  // Delete from TRNA_DATA table for the current trnad_id
  function _deleteTrnaData(trnad_id, objLogInfo, callBackDeleteTrnaData) {
    try {
      reqInstanceHelper.PrintInfo(serviceName, 'Calling executeFXDeleteQuery method', objLogInfo);
      executeFXDeleteQuery(mCasIns, 'trna_data', {
        'trnad_id': trnad_id
      }, function (resp) {
        var resObj = sendMethodResponse('SUCCESS', '', resp, '', '', '');
        callBackDeleteTrnaData(resObj);
      });
    } catch (ex) {
      var resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-40503', 'Exception occurs during execution of _deleteTrnaData method', ex);
      callBackDeleteTrnaData(resObj);
    }
  }
  // Execute query in transaction DB
  function executeTranQuery(query, logInfo, callbackExec) {
    var resObj = {};
    try {
      reqInstanceHelper.PrintInfo(serviceName, 'Executing Transactional Query', objLogInfo);
      reqTranDBInstance.ExecuteSQLQuery(mTranDB, query, logInfo, function (resp) {
        if (resp) {
          resObj = sendMethodResponse('SUCCESS', '', resp, '', '', '');
          callbackExec(resObj);
        } else {
          resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-40506', 'Tran Query execution failed', '');
          callbackExec(resObj);
        }
      });
    } catch (ex) {
      resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-40507', 'Tran Query execution failed', ex);
      callbackExec(resObj);
    }
  }


  // Delete from attachments
  function _deleteFromAttachments(trna_id, logInfo, callBackDeleteAttachments) {
    try {
      QUERY_DELETE_FROM_ATTACHMENTS = QUERY_DELETE_FROM_ATTACHMENTS.replace(/@TRNAID/g, trna_id);

      executeTranQuery(QUERY_DELETE_FROM_ATTACHMENTS, function (resp) {
        callBackDeleteAttachments(resp);
      });
    } catch (ex) {
      var resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-40504', 'Exception occurs in _getTrnaIDFromRelativePath method', ex, '', '');
      callBackDeleteAttachments(resObj);
    }
  }

  // Get TRNA ID using relative path from trna_data 
  function _getTrnaIDFromRelativePath(relativePath, callbackTrnaID) {
    try {
      var strRelativePath = relativePath.toUpperCase();
      var cond = {
        'relative_path': strRelativePath
      };
      executeFXSelectQuery(mCasIns, 'trna_data', ['trnad_id'], cond, function (response) {
        callbackTrnaID(response);
      });
    } catch (ex) {
      var resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-40505', 'Exception occurs in _getTrnaIDFromRelativePath method', ex, '', '');
      callbackTrnaID(resObj);
    }
  }

});

// Send response to mail function
function sendMethodResponse(status, successMessage, SuccessDataObj, errorCode, errorMessage, errorObject) {
  var obj = {
    'STATUS': status,
    'SUCCESS_MESSAGE': successMessage,
    'SUCCESS_DATA': SuccessDataObj,
    'ERROR_CODE': errorCode,
    'ERROR_MESSAGE': errorMessage,
    'ERROR_OBJECT': errorObject
  };
  return obj;
}

module.exports = router;
  /*********** End of Service **********/