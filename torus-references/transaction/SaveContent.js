/*
  @Decsription: Helper file for Save Content api
*/

// Require dependencies
var reqDBInstance = require('../instance/DBInstance');
var reqTranDBHelper = require('../instance/TranDBInstance')
var reqInstanceHelper = require('../common/InstanceHelper')
var reqUuid = require('uuid')
var reqDateFormatter = require('../common/dateconverter/DateFormatter');
var reqAuditLog = require('../log/audit/AuditLog');

var strServiceName = 'SaveContent'

// Common function for scan and save content functions
function ScanSaveContent(req, reqdata, dynamicresult, pCallback) {
  try {
    // Cassandra initialization
    var mClient
    var mTranDB
    var strfoldertrn_id = ''
    var objLogInfo = req.objLogInfo;
    var isscan = ''
    var pHeaders = reqdata.headers;
    var process_info = reqdata.body.PROCESS_INFO;
    if(typeof process_info == 'string'){
       process_info = JSON.parse(process_info);
    }
     objLogInfo.PROCESS_INFO = process_info;
    pHeaders['routingkey'] = pHeaders['routingkey'].toUpperCase();
    reqTranDBHelper.GetTranDBConn(reqdata.headers, true, function (pSession) {
      try {
        mTranDB = pSession;
        reqAuditLog.GetProcessToken(mTranDB, objLogInfo, function (err, prct_id) {
          try {
              if (err) {
                  return sendResponse(prepareErrorData('FAILURE', 'Error Code', 'Error in GetProcessToken function'));
              }
              objLogInfo.PROCESS_INFO.PRCT_ID = prct_id;
              reqDBInstance.GetFXDBConnection(reqdata.headers, 'dep_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
                mClient = pClient
                // Initialize local variables
                var strAppStsId = req.APPSTS_ID
                var strAppId = req.APP_ID
                var strAtmtDtCode = req.ATMT_DT_CODE
                var strDttCode = req.DTT_CODE
                var strDtCode = req.DT_CODE
                var strLogInfo = req.LOGINFO || req
                var strLoginName = req.LOGIN_NAME
                var strRSParams = req.RSPARAMS
                var strSysDesc = req.SYSTEM_DESC
                var strSysId = req.SYSTEM_ID
                var strTrnId = req.TRN_ID
                var atmtDTcode = req.ATMT_DT_CODE
                var dtcode = req.DT_CODE
                var strRelJson = ''
                var ishaschilddt = req.HAS_CHILD
                if (req.HAS_CHILD == undefined) {
                  ishaschilddt = 'N'
                }
                var strSource = req.SOURCE ? req.SOURCE : 'MANUAL'
                var strSourceDet = req.SOURCE_DETAILS ? req.SOURCE_DETAILS : 'FROM FOLDER'
                var strParentKeyColumn = req.PARENTKEYCOLUMN
                var strParentKeyValue = req.PARENTKEYVALUE
                var arrAtmtDTTRel = []
                var arrRSPItem = []
                var strGroupId = ''
                var strAtmtTsId = '0'
                var strAtmtTRNId = '0'
                var strChkTrnId = ''
                var strATDesc = ''
                var strAttachTitle = ''
                var strDttaId = '0'
                var strDttadId = '0'
                var strInputParam = req
                var strFolderdttcode = ''
                var strDtDesc = ''
                var arrDTTRel = []
                if (strSource == 'SCAN') {
                  strFolderdttcode = req.FOLDER_DTT_CODE
                  strfoldertrn_id = req.FOLDER_TRN_ID
                }
                if (req != '' && strDtCode != '') {
                  SelectDTInfo(strDtCode)
                }else{
                  return sendErrorResponse('FAILURE', 'ERR-HAN-40626', 'DT_CODE should not empty', null);
                }
      
                // Query dt_info
                function SelectDTInfo(pDtCode) {
                  try {
                    if (pDtCode == strAtmtDtCode) {
                      reqDBInstance.GetTableFromFXDB(mClient, 'dt_info', ['app_id', 'dt_code', 'dt_description', 'relation_json'], {
                        dt_code: pDtCode,
                        app_id: strAppId
                      }, objLogInfo, function callbackSelA(pError, pResult) {
                        if (pError) {
                          sendResponse('FAILURE', 'ERR-HAN-40601', 'Error While dt_info Execution', pError)
                        } else if (pResult) {
                          try {
                            if (pResult.rows.length > 0)
                              strRelJson = JSON.parse(pResult.rows[0].relation_json)
                            _GetRSParams()
                          } catch (error) {
                            sendResponse('FAILURE', 'ERR-HAN-40602', 'Error in SelectDTInfo-_GetRSParams', error)
                          }
                        }
                      })
                    } else if (pDtCode != '' && strAtmtDtCode != '') {
                      if (pDtCode != strAtmtDtCode) {
                        strDtCode = strAtmtDtCode
                        SelectDTInfo(strAtmtDtCode)
                      }
                    } else if (pDtCode != '' && strAtmtDtCode == '') {
                      strAtmtDtCode = pDtCode
                      SelectDTInfo(pDtCode)
                    }
                  } catch (error) {
                    sendResponse('FAILURE', 'ERR-HAN-40603', 'Error in SelectDTInfo', error)
                  }
                }
      
                // Recursive function for prepare DTT relation json for child dtts
                function _PrepareDttRelation(strRelJson, strdtcode) {
                  try {
                    if (strRelJson[0].CHILD_DTT_RELEATIONS.length > 0) {
                      strChildDTTRel = strRelJson[0].CHILD_DTT_RELEATIONS
                      for (var i = 0; i < strChildDTTRel.length; i++) {
                        if (strChildDTTRel[i].CATEGORY == 'T') {
                          objChildDTTRel = {}
                          objChildDTTRel.DTT_CATEGORY = strChildDTTRel[i].CATEGORY
                          objChildDTTRel.DTT_DESCRIPTION = strChildDTTRel[i].DTT_DESCRIPTION
                          objChildDTTRel.DTT_CODE = strChildDTTRel[i].DTT_CODE
                          objChildDTTRel.TARGET_TABLE = strChildDTTRel[i].TARGET_TABLE
                          objChildDTTRel.PRIMARY_COLUMN = strChildDTTRel[i].PRIMARY_COLUMN
                          arrDTTRel.push(objChildDTTRel)
                          if (strChildDTTRel[i].CHILD_DTT_RELEATIONS.length > 0) {
                            strChildDTTRel = strChildDTTRel[i].CHILD_DTT_RELEATIONS
                            _PrepareDttRelation()
                          }
                        } else if (strChildDTTRel[i].CATEGORY == 'S') {
                          if (strChildDTTRel[i].CHILD_DTT_RELEATIONS.length > 0) {
                            strChildDTTRel = strChildDTTRel[i].CHILD_DTT_RELEATIONS
                            _PrepareDttRelation()
                          }
                        }
                      }
                    }
                    _PrepareATMTDttRelation(strRelJson, strdtcode)
                  } catch (error) {
                    sendResponse('FAILURE', 'ERR-HAN-40624', 'Error in _PrepareDttRelation', error)
                  }
                }
      
                // Recursive function for preparing ATMT_DTT relation json
                function _PrepareATMTDttRelation(strRelJson, strdtcode) {
                  try {
                    if (strRelJson[0].CHILD_DTT_RELEATIONS.length > 0) {
                      strChildDTTRel = strRelJson[0].CHILD_DTT_RELEATIONS
                      for (var i = 0; i < strChildDTTRel.length; i++) {
                        if (strChildDTTRel[i].CATEGORY == 'S') {
                          objChildAtmtDTTRel = {}
                          objChildAtmtDTTRel.DTT_CATEGORY = strChildDTTRel[i].CATEGORY
                          objChildAtmtDTTRel.DTT_DESCRIPTION = strChildDTTRel[i].DTT_DESCRIPTION
                          objChildAtmtDTTRel.DTT_CODE = strChildDTTRel[i].DTT_CODE
                          objChildAtmtDTTRel.TARGET_TABLE = strChildDTTRel[i].TARGET_TABLE
                          objChildAtmtDTTRel.PRIMARY_COLUMN = strChildDTTRel[i].PRIMARY_COLUMN
                          arrAtmtDTTRel.push(objChildAtmtDTTRel)
                          if (strChildDTTRel[i].CHILD_DTT_RELEATIONS.length > 0) {
                            strChildDTTRel = strChildDTTRel[i].CHILD_DTT_RELEATIONS
                            _PrepareATMTDttRelation()
                          }
                        } else if (strChildDTTRel[i].CATEGORY == 'T') {
                          if (strChildDTTRel[i].CHILD_DTT_RELEATIONS.length > 0) {
                            strChildDTTRel = strChildDTTRel[i].CHILD_DTT_RELEATIONS
                            _PrepareATMTDttRelation()
                          }
                        }
                      }
                    }
                    _GetRSParams()
                  } catch (error) {
                    sendResponse('FAILURE', 'ERR-HAN-40604', 'Error in _PrepareATMTDttRelation', error)
                  }
                }
      
                // Parse and prepare input data into array
                function _GetRSParams() {
                  var arrGetRSP = []
                  try {
                    if (strRSParams != '') {
                      if (typeof strRSParams == 'string' && strSource == 'MANUAL') {
                        var strPrsRsParams = JSON.parse(strRSParams)
                        // strLogInfo = JSON.parse(strLogInfo)
                        for (i = 0; i < strPrsRsParams.Items.length; i++) {
                          arrGetRSP.push(strPrsRsParams.Items[i])
                        }
                      } else {
                        var strPrsRsParams = strRSParams
                        // strLogInfo = strLogInfo
                        for (i = 0; i < strPrsRsParams.Items.length; i++) {
                          arrGetRSP.push(strPrsRsParams.Items[i])
                        }
                      }
                      _SaveContent(arrGetRSP)
                    }
                  } catch (error) {
                    sendResponse('FAILURE', 'ERR-HAN-40605', 'Error in _GetRSParams', error)
                  }
                }
      
                // Get the target table and keyclumn for given dtt from relation json
                function GetTargetTableAndKeyColumn(pRelationJson, pDTTCode) {
                  var tmpStr = ''
                  for (var i = 0; i < pRelationJson.length; i++) {
                    tmpStr = _GetHierarchyDTT(pRelationJson[i], pDTTCode)
                    if (tmpStr != undefined && tmpStr != '')
                      break
                  }
                  return tmpStr
                }
      
                // Recursive function for getting a dtt details from gierarchy relation json
                function _GetHierarchyDTT(pRelationJson, pDTTCode) {
                  try {
                    var objRelationJson = pRelationJson
                    var strTargetTable = ''
                    var strKeyColumn = ''
                    var strDTTDescription = ''
                    var strDTTCategory = ''
                    // Find targettable and keycolumn for selected DTTCode
                    if (objRelationJson.DTT_CODE == pDTTCode) {
                      strTargetTable = objRelationJson['TARGET_TABLE']
                      strKeyColumn = objRelationJson['PRIMARY_COLUMN']
                      strDTTDescription = objRelationJson['DTT_DESCRIPTION']
                      strDTTCategory = objRelationJson['CATEGORY']
                      return strTargetTable + ',' + strKeyColumn + ',' + strDTTDescription + ',' + strDTTCategory
                    }
                    // find on child dtt relation
                    for (var i = 0; i < objRelationJson.CHILD_DTT_RELEATIONS.length; i++) {
                      if (objRelationJson.CHILD_DTT_RELEATIONS[i].DTT_CODE == pDTTCode) {
                        strTargetTable = objRelationJson.CHILD_DTT_RELEATIONS[i]['TARGET_TABLE']
                        strKeyColumn = objRelationJson.CHILD_DTT_RELEATIONS[i]['PRIMARY_COLUMN']
                        strDTTDescription = objRelationJson.CHILD_DTT_RELEATIONS[i]['DTT_DESCRIPTION']
                        strDTTCategory = objRelationJson.CHILD_DTT_RELEATIONS[i]['CATEGORY']
                        return strTargetTable + ',' + strKeyColumn + ',' + strDTTDescription + ',' + strDTTCategory
                      }
                      _GetHierarchyDTT(objRelationJson.CHILD_DTT_RELEATIONS[i], pDTTCode, pLogInfo)
                    }
                  } catch (ex) {
                    sendResponse('FAILURE', 'ERR-HAN-40606', 'Error in _GetHierarchyDTT', error)
                  }
                }
      
                // Preparation for insert attachment
                function _SaveContent(arrGetRSP) {
                  try {
                    isscan = strLogInfo.IsScan || '';
                    console.log('the value are ' + isscan);
                    if (strRSParams != '') {
                      strGroupId = 'GRP_' + strLogInfo.USER_ID + ((Date.now() * 10000) + 621355968000000000)
                      for (i = 0; i < arrGetRSP.length; i++) {
                        var strRSPAtmtDttCode = arrGetRSP[i].ATMT_DTT_CODE
                        var strRSPTrnId = arrGetRSP[i].TRN_ID
                        if (strSource == 'SCAN') {
                          strTrnId = strRSPTrnId
                        }
                        arrRSPItem = []
                        arrRSPItem.push(arrGetRSP[i])
                        if (arrGetRSP[i].AT_CODE != '') {
                          _GetATDescription()
                        }
      
                        function afterGetTitle() {
                          // DATA class MUST
                          if (strRSPTrnId != '' && strRSPAtmtDttCode != '' && (dtcode != atmtDTcode)) {
                            _InsertTran(arrGetRSP)
                          }
                          // NO NEED DATA CLASS
                          if ((strRSPTrnId != '' && strRSPTrnId != "undefined") && (strRSPAtmtDttCode == '' || strRSPAtmtDttCode == null || strRSPAtmtDttCode == undefined)) {
                            _InsATMT(arrGetRSP)
                          }
      
                          if (isscan === '') {
                            if (strRSPTrnId == '' && strChkTrnId == '' || ishaschilddt == 'N') {
                              _InsertTran(arrGetRSP)
                            }
                          } else {
                            if (strRSPTrnId == '' && (strChkTrnId == '' || ishaschilddt == 'N')) {
                              _InsertTran(arrGetRSP)
                            }
                          }
      
                          // NO NEED DATA CLASS
                          if ((strRSPTrnId == '' && strChkTrnId != '')) {
                            _InsATMT(arrGetRSP)
                          }
                          if (strRSPTrnId != '' && strRSPAtmtDttCode != '' && (dtcode == atmtDTcode) && ishaschilddt == 'Y') {
                            _InsATMT(arrGetRSP)
                          }
                        }
      
                        if (arrGetRSP[i].DTTA_ID != '') {
                          _GetAttachmentTitle(afterGetTitle);
                        } else if (arrGetRSP[i].DTTA_ID == '' || arrGetRSP[i].DTTA_ID == null || arrGetRSP[i].DTTA_ID == 0 || arrGetRSP[i].DTTA_ID == undefined) {
                          _GetAttachmentTitle(afterGetTitle);
                        }
                        break;
                      }
                    }
                  } catch (error) {
                    sendResponse('FAILURE', 'ERR-HAN-40607', 'Error in _SaveContent', error)
                  }
                }
                var pLogInfo = null
      
                // Prepare and insert target table data row for DATA_CLASS context
                function _InsertTran(parrGetRSP) {
                  try {
                    var resdtt_code = ''
                    var strDTTCATEGORY = ''
                    var strDTTDESCRIPTION = ''
                    var strDTTCODE = ''
                    var strTARGETTABLE = ''
                    var strPRIMARYCOLUMN = ''
                    var strAtmtDttCD = arrRSPItem[0].ATMT_DTT_CODE
                    if (strTrnId != 0) {
                      if (strAtmtDttCD != '' && strTrnId != 0) {
                        var strTemp = GetTargetTableAndKeyColumn(strRelJson, strAtmtDttCD)
                        var strDTTInfo = strTemp.split(',')
                        strDTTCATEGORY = strDTTInfo[3]
                        strDTTDESCRIPTION = strDTTInfo[2]
                        strDTTCODE = strAtmtDttCD
                        strTARGETTABLE = strDTTInfo[0]
                        strPRIMARYCOLUMN = strDTTInfo[1]
                      } else if (strAtmtDttCD == '' || strAtmtDttCD == null || strAtmtDttCD == undefined) {
                        _InsATMT(parrGetRSP)
                      }
                    } else if (strTrnId == 0 && strChkTrnId == 0) {
                      var strTemp = GetTargetTableAndKeyColumn(strRelJson, strDttCode)
                      var strDTTInfo = strTemp.split(',')
                      strDTTCATEGORY = strDTTInfo[3]
                      strDTTDESCRIPTION = strDTTInfo[2]
                      strDTTCODE = strDttCode
                      strTARGETTABLE = strDTTInfo[0]
                      strPRIMARYCOLUMN = strDTTInfo[1]
                    } else if (strTrnId == 0 && strChkTrnId != 0 && strAtmtDttCD != '') {
                      var strTemp = GetTargetTableAndKeyColumn(strRelJson, strAtmtDttCD)
                      var strDTTInfo = strTemp.split(',')
                      strDTTCATEGORY = strDTTInfo[3]
                      strDTTDESCRIPTION = strDTTInfo[2]
                      strDTTCODE = strAtmtDttCD
                      strTARGETTABLE = strDTTInfo[0]
                      strPRIMARYCOLUMN = strDTTInfo[1]
                    }
                    var arrTableIns = []
                    var objTabValue = {}
                    if (strSource == 'SCAN') {
                      if (arrRSPItem[0].ATMT_DTT_CODE == '') {
                        if (strParentKeyColumn != '' && strParentKeyValue != '' && strParentKeyValue != "undefined") {
                          objTabValue[strParentKeyColumn] = strParentKeyValue
                        }
                      }
                    }
                    objTabValue.CREATED_BY = strLogInfo.USER_ID
                    objTabValue.CREATED_BY_NAME = strLogInfo.USER_NAME
                    objTabValue.SYSTEM_ID = strLogInfo.SYSTEM_ID
                    objTabValue.SYSTEM_NAME = strLogInfo.SYSTEM_DESC
                    objTabValue.CREATED_DATE = new Date()
                    if (strLogInfo.SCAN_STATUS == '') {
                      strLogInfo.SCAN_STATUS = 'CREATED';
                    }
                    if (strLogInfo.SCAN_PROCESS_STATUS == '') {
                      strLogInfo.SCAN_PROCESS_STATUS = 'CREATED';
                    }
                    objTabValue.STATUS = strLogInfo.SCAN_STATUS;
                    objTabValue.PROCESS_STATUS = strLogInfo.SCAN_PROCESS_STATUS;
                    objTabValue.DT_CODE = strDtCode
                    objTabValue.DT_DESCRIPTION = strDtDesc
                    if (arrRSPItem[0].ATMT_DTT_CODE != '') {
                      objTabValue.DTT_CODE = arrRSPItem[0].ATMT_DTT_CODE
                      objTabValue.DTT_DESCRIPTION = strDTTDESCRIPTION
                    } else {
                      objTabValue.DTT_CODE = strDttCode
                      objTabValue.DTT_DESCRIPTION = strDTTDESCRIPTION
                    }
      
                    // scan table data  save
                    var tabledatadynamicresult = '';
                    if (strLogInfo.dynamicresult != '' && strLogInfo.dynamicresult != undefined && strLogInfo.dynamicresult != null) {
                      console.log('dynamicresult') //Dynamicresultcontent
                      console.log(strLogInfo.dynamicresult)
                      tabledatadynamicresult = strLogInfo.dynamicresult;
                    }
                    if (tabledatadynamicresult != '') {
                      console.log('DYNAMIC DATA SAVE STARTED.')
                      console.log(tabledatadynamicresult)
                      var type = (typeof tabledatadynamicresult)
                      var arrjtokenvalue = ''
                      if (type == 'string') {
                        console.log('PARSED RESULT')
                        arrjtokenvalue = JSON.parse(tabledatadynamicresult)
                      } else {
                        arrjtokenvalue = tabledatadynamicresult
                      }
                      console.log(arrjtokenvalue.length)
                      console.log(tabledatadynamicresult.length)
                      for (var i = 0; i < arrjtokenvalue.length; i++) {
                        console.log('GET DYNAMIC DATA VALUE')
                        var jtokenvalue = arrjtokenvalue[i]
                        if (jtokenvalue.Data != '') {
                          var controlname = jtokenvalue.targetcolumn
                          var controlvalue = jtokenvalue.Data
                          var datatype = jtokenvalue.datatype
                          var DATA_LENGTH = jtokenvalue.DATA_LENGTH
                          var controlvaluelength = controlvalue.length
                          if (datatype == 'TEXT') {
                            console.log('controlname')
                            console.log(controlname)
                            console.log('controlvalue')
                            console.log(controlvalue)
                            if (DATA_LENGTH == '0') {
                              console.log('controlvalue starter')
                              //controlvalue = controlvalue.replace(/[^0-9\.]+/g, '')
                              console.log('get number only')
                              var numvalue;
                              try {
                                numvalue = parseFloat(controlvalue)
                              } catch (e) {
                                console.log('parse error')
                              }
                              console.log('controlvalue starter')
                              console.log('numvalue starter')
                              if (typeof numvalue == 'number') {
                                if (isNaN(numvalue) == false) {
                                  console.log('Number starter')
      
                                  if (controlname == 'TRN_ID' && strAtmtDtCode != '') {
                                    strfoldertrn_id = controlvalue;
                                  } else {
                                    objTabValue[controlname] = controlvalue
                                  }
                                } else {
                                  console.log('String starter')
                                  objTabValue[controlname] = controlvalue
                                }
                              }
                            }
                            if (controlvaluelength <= DATA_LENGTH) {
                              controlvalue = controlvalue.match(/[a-z 0-9().,]/gi).join('')
                              objTabValue[controlname] = controlvalue
                            }
                          }
                          if (datatype == 'NUMBER') {
                            controlvalue = controlvalue.replace(/[^0-9\.]+/g, '')
                            var numvalue = parseFloat(controlvalue)
                            if (typeof numvalue == 'number') {
                              if (isNaN(numvalue) == false) {
                                objTabValue[controlname] = numvalue
                              }
                            }
                          }
                          if (datatype == 'DATETIME') {
                            var d = ''
                            d = reqDateFormatter.ConvertDate(controlvalue, pHeaders);
                           // d = moment(controlvalue, 'MMM DD,YYYY', 'en')
                            if (d != '') {
                                objTabValue[controlname] = d
                            }                                     
                          }
                        }
                      }
                    }
      
                    // ocr api dynamic data save
                    if (dynamicresult != '') {
                      var type = (typeof dynamicresult)
                      var arrjtokenvalue = ''
                      if (type == 'string') {
                        arrjtokenvalue = JSON.parse(dynamicresult)
                      } else {
                        arrjtokenvalue = dynamicresult
                      }
                      for (var i = 0; i < arrjtokenvalue.length; i++) {
                        var jtokenvalue = arrjtokenvalue[i]
                        if (jtokenvalue.Data != '') {
                          var controlname = jtokenvalue.targetcolumn
                          var controlvalue = jtokenvalue.Data
                          var datatype = jtokenvalue.datatype
                          var DATA_LENGTH = jtokenvalue.DATA_LENGTH
                          var controlvaluelength = controlvalue.length
      
                          if (datatype == 'TEXT') {
                            if (controlvaluelength <= DATA_LENGTH) {
                              controlvalue = controlvalue.match(/[a-z 0-9().,]/gi).join('')
      
                              objTabValue[controlname] = controlvalue
      
                            }
                          }
                          if (datatype == 'NUMBER') {
                            var numvalue
                            controlvalue = controlvalue.replace(/[^0-9\.]+/g, '')
                            numvalue = parseFloat(controlvalue)
                            if (typeof numvalue == 'number') {
                              if (isNaN(numvalue) == false) {
                                objTabValue[controlname] = numvalue
                              }
                            }
                          }
                          if (datatype == 'DATETIME') {
                            var d = ''
                            d = reqDateFormatter.ConvertDate(controlvalue, pHeaders);
                           // d = moment(controlvalue, 'MMM DD,YYYY', 'en')
                            if (d != '') {
                                objTabValue[controlname] = d
                            }     
                          }
                        }
                      }
                    }
      
                    objTabValue.PRCT_ID = objLogInfo.PROCESS_INFO.PRCT_ID;
                    objTabValue.VERSION_NO = '0';
                    objTabValue.MODIFIED_BY = strLogInfo.USER_ID;
                    objTabValue.MODIFIED_DATE = new Date();
                    arrTableIns.push(objTabValue);
                    reqTranDBHelper.InsertTranDB(mTranDB, strTARGETTABLE, arrTableIns, pLogInfo, function (pResult, pErr) {
                      try {
                        if (pResult) {
                          console.log('Target Table Inseted')
                          var result = pResult[0]
                          var strPrimaryCol = result[strPRIMARYCOLUMN.toLowerCase()]
                          if (req.DTT_CODE != result.dtt_code) {
                            resdtt_code = req.DTT_CODE
                          } else {
                            resdtt_code = result.dtt_code
                          }
                          _InsTranset(strPrimaryCol, result.dtt_code, result.dtt_description, parrGetRSP)
                          console.log('_InsTranset completed')
                        } else {
                          // reqTranDBHelper.Commit(mTranDB, false, function callbackres(res) {});'
                          sendResponse('FAILURE', 'ERR-HAN-40625', 'Error in inserting ' + strTARGETTABLE + ' insert', pErr)
                        }
                      } catch (error) {
                        sendResponse('FAILURE', 'ERR-HAN-40608', 'Error in inserting ' + strTARGETTABLE + ' insert', error)
                      }
                    })
                  } catch (error) {
                    sendResponse('FAILURE', 'ERR-HAN-40609', 'Error in _InsertTran', error)
                  }
                }
      
                // To insert into transaction_set table
                function _InsTranset(pPrimaryCol, pDttcode, pdtt_description, parrGetRSP) {
                  try {
                    strChkTrnId = strTrnId;
                    var arrTableIns = [];
                    var objTabValue = {};
                    objTabValue.CREATED_BY = strLogInfo.USER_ID;
                    objTabValue.CREATED_BY_NAME = strLogInfo.USER_NAME;
                    objTabValue.SYSTEM_ID = strLogInfo.SYSTEM_ID;
                    objTabValue.SYSTEM_NAME = strLogInfo.SYSTEM_DESC;
                    objTabValue.CREATED_DATE = new Date();
                    objTabValue.STATUS = 'CREATED';
                    objTabValue.PROCESS_STATUS = 'CREATED';
                    objTabValue.DT_CODE = strDtCode;
                    objTabValue.DT_DESCRIPTION = strDtDesc;
                    objTabValue.DTT_CODE = pDttcode;
                    objTabValue.DTT_DESCRIPTION = pdtt_description;
                    objTabValue.PRCT_ID = objLogInfo.PROCESS_INFO.PRCT_ID;
                    objTabValue.VERSION_NO = '0';
                    objTabValue.MODIFIED_BY = strLogInfo.USER_ID;
                    objTabValue.MODIFIED_DATE = new Date();
                    objTabValue.TRN_ID = pPrimaryCol;
                    objTabValue.GROUP_ID = strGroupId;
                    if (strLogInfo.TS_SCAN_STATUS == '') {
                      strLogInfo.TS_SCAN_STATUS = 'CREATED';
                    }
                    if (strLogInfo.TS_SCAN_PROCESS_STATUS == '') {
                      strLogInfo.TS_SCAN_PROCESS_STATUS = 'CREATED';
                    }
                    objTabValue.STATUS = strLogInfo.TS_SCAN_STATUS;
                    objTabValue.PROCESS_STATUS = strLogInfo.TS_SCAN_PROCESS_STATUS;
                    arrTableIns.push(objTabValue)
                    reqTranDBHelper.InsertTranDB(mTranDB, 'TRANSACTION_SET', arrTableIns, pLogInfo, function (pResult, pErr) {
                      try {
                        if (pResult) {
                          console.log('TRANSACTION_SET Table Inserted')
                          var res = pResult[0]
                          strAtmtTsId = res.ts_id
                          strAtmtTRNId = res.trn_id
                          strChkTrnId = res.trn_id
      
                          if (strTrnId != 0 && pPrimaryCol != '') {
                            _InsATMT(parrGetRSP)
                          } else if (strTrnId == 0 && (arrRSPItem[0].ATMT_DTT_CODE == '' || arrRSPItem[0].ATMT_DTT_CODE == null || arrRSPItem[0].ATMT_DTT_CODE == undefined)) {
                            _InsATMT(parrGetRSP)
                          } else if (strTrnId == 0 && strChkTrnId != 0 && (arrRSPItem[0].ATMT_DTT_CODE != '' || arrRSPItem[0].ATMT_DTT_CODE != null || arrRSPItem[0].ATMT_DTT_CODE != undefined)) {
                            if (strSource == 'SCAN') {
                              _InsATMT(parrGetRSP)
                            } else {
                              _InsertTran(parrGetRSP)
                            }
                          }
                          // sendResponse('SUCCESS', '', '', '')
                        } else {
                          sendResponse('FAILURE', 'ERR-HAN-40610', 'Error In Transaction set insert', pErr)
                        }
                      } catch (error) {
                        sendResponse('FAILURE', 'ERR-HAN-40611', 'Error in _InsTranset', error)
                      }
                    })
                  } catch (error) {
                    sendResponse('FAILURE', 'ERR-HAN-40612', 'Error in _InsTranset', error)
                  }
                }
      
                // To prepare and insert into trn_attachments
                function _InsATMT(parrGetRSP) {
                  try {
                    var arrTableIns = []
                    var objTabValue = {}
                    objTabValue.RELATIVE_PATH = arrRSPItem[0].RELATIVE_PATH
                    objTabValue.ORIGINAL_FILE_NAME = arrRSPItem[0].FILE_NAME
                    objTabValue.FILE_SIZE = arrRSPItem[0].FILE_SIZE
                    objTabValue.RESOURCE_SERVER_CODE = arrRSPItem[0].RS_CODE
                    if (arrRSPItem[0].AT_CODE != '') {
                      objTabValue.AT_CODE = arrRSPItem[0].AT_CODE
                    } else {
                      objTabValue.AT_CODE = 'UNKNOWN'
                    }
                    objTabValue.COMMENT_TEXT = arrRSPItem[0].COMMENT
                    objTabValue.ATMT_DTT_CODE = arrRSPItem[0].ATMT_DTT_CODE
                    if (arrRSPItem[0].DTTA_ID != 0) {
                      objTabValue.DTTA_ID = arrRSPItem[0].DTTA_ID
                    } else {
                      objTabValue.DTTA_ID = strDttaId
                    }
                    if (arrRSPItem[0].DTTAD_ID != 0) {
                      objTabValue.DTTAD_ID = arrRSPItem[0].DTTAD_ID
                    } else {
                      objTabValue.DTTAD_ID = strDttadId
                    }
                    objTabValue.DTTADIF_ID = arrRSPItem[0].DTTADIF_ID
                    objTabValue.DTTAC_DESC = arrRSPItem[0].DTTAC_DESC
                    if (arrRSPItem[0].ATMT_DTT_CODE != '') {
                      objTabValue.ATMT_TS_ID = strAtmtTsId
                      objTabValue.ATMT_TRN_ID = strAtmtTRNId
                    } else {
                      objTabValue.ATMT_TS_ID = '0'
                      objTabValue.ATMT_TRN_ID = '0'
                    }
                    objTabValue.AT_DESCRIPTION = strATDesc
                    objTabValue.ATTACHMENT_TITLE = strAttachTitle
                    objTabValue.TOTAL_PAGES = '0'
                    objTabValue.IS_CURRENT = 'Y'
                    objTabValue.IS_DELETED = 'N'
                    objTabValue.SOURCE = strSource
                    objTabValue.SOURCE_DETAILS = strSourceDet
                    objTabValue.CREATED_BY = strLogInfo.USER_ID
                    objTabValue.CREATED_BY_NAME = strLogInfo.USER_NAME
                    objTabValue.SYSTEM_ID = strLogInfo.SYSTEM_ID
                    objTabValue.SYSTEM_NAME = strLogInfo.SYSTEM_DESC
                    objTabValue.CREATED_DATE = new Date()
                    objTabValue.DT_CODE = strDtCode
                    objTabValue.DTT_CODE = strDttCode
                    if (arrRSPItem[0].ATMT_DTT_CODE != '' && strSource == 'SCAN') {
                      objTabValue.DTT_CODE = strFolderdttcode
                    }
                    objTabValue.VERSION_NO = '0'
                    objTabValue.MODIFIED_BY = strLogInfo.USER_ID
                    objTabValue.MODIFIED_DATE = new Date()
                    if (strTrnId == '') {
                      objTabValue.TRN_ID = strChkTrnId
                    } else {
                      objTabValue.TRN_ID = strTrnId
                    }
                    if (arrRSPItem[0].ATMT_DTT_CODE != '' && strSource == 'SCAN') {
                      objTabValue.TRN_ID = strfoldertrn_id
                    }
                    objTabValue.GROUP_ID = strGroupId
                    arrTableIns.push(objTabValue)
                    reqTranDBHelper.InsertTranDB(mTranDB, 'TRN_ATTACHMENTS', arrTableIns, pLogInfo, function (pResult, pErr) {
                      try {
                        if (pResult) {
                          console.log('TRN_ATTACHMENTS Table Inserted')
                          parrGetRSP.shift()
                          if (parrGetRSP.length > 0) {
                            _SaveContent(parrGetRSP)
                          }
                          else {
                            var strResult = 'SUCCESS'
                            return sendResponse('SUCCESS', '', '', '')
                            //return sendResponse(strResult, '', '', '');
                            //successcallback(strResult)
                          }
                          // } else {
                          //   var strResult = 'SUCCESS'
                          //   //return sendResponse(strResult, '', '', '');
                          //   //successcallback(strResult)
                          // }
      
                        } else {
                          return sendResponse('FAILURE', 'ERR-HAN-40613', 'Error in TRN_ATTACHMENTS Insert', pErr)
                        }
                      } catch (error) {
                        sendResponse('FAILURE', 'ERR-HAN-40614', 'Error in TRN_ATTACHMENTS Insert', error)
                      }
                    })
                  } catch (error) {
                    sendResponse('FAILURE', 'ERR-HAN-40615', 'Error in _InsATMT', error)
                  }
                }
      
                // Query attachment_types code and description
                function _GetATDescription() {
                  try {
                    var strATC = arrRSPItem[0].AT_CODE
                    reqDBInstance.GetTableFromFXDB(mClient, 'attachment_types', ['at_code', 'at_description'], {
                      at_code: strATC
                    }, objLogInfo, function callbackSelA(pError, pResult) {
                      if (pError) {
                        sendResponse('FAILURE', 'ERR-HAN-40616', 'Error while attachment_types Execution', pError)
                      } else if (pResult) {
                        try {
                          if (pResult.rows.length > 0) {
                            strATDesc = pResult.rows[0].at_description
                          }
                        } catch (error) {
                          sendResponse('FAILURE', 'ERR-HAN-40617', 'Error in strATDesc_ _GetATDescription', error)
                        }
                      }
                    })
                  } catch (error) {
                    sendResponse('FAILURE', 'ERR-HAN-40618', 'Error in  _GetATDescription', error)
                  }
                }
      
                // Get the DTT_ATTACHMENT details from dtt_info json
                function _GetAttachmentTitle(callback) {
                  try {
                    reqDBInstance.GetTableFromFXDB(mClient, 'dtt_info', ['app_id', 'dtt_code', 'dtt_description', 'dtt_dfd_json'], {
                      dtt_code: strDttCode,
                      app_id: strAppId
                    }, objLogInfo, function callbackSelA(pError, pResult) {
                      if (pError) {
                        sendResponse('FAILURE', 'ERR-HAN-40619', 'Error While dtt_info Execution', pError)
                      } else if (pResult) {
                        try {
                          var strDttInfoDFDJson = pResult.rows[0].dtt_dfd_json.toString().replace(/\\/g, '')
                          var strDttDfdJson2 = JSON.parse(strDttInfoDFDJson)
                          var objDttAtmt = {}
                          if (strDttDfdJson2.DTT_ATTACHMENT != '') {
                            var strDttAtmt = strDttDfdJson2.DTT_ATTACHMENT
                            for (var i = 0; i < strDttAtmt.length; i++) {
                              if (arrRSPItem[0].DTTA_ID == strDttAtmt[i].DTTA_ID) {
                                strAttachTitle = strDttAtmt[i].ATTACH_TITLE;
                                strDttaId = strDttAtmt[i].DTTA_ID;
                                strDttadId = strDttAtmt[i].DTTAD_ID;
                                break;
                              }
                            }
                           
                          }
                           callback();
                        } catch (error) {
                          sendResponse('FAILURE', 'ERR-HAN-40620', 'Error in _GetAttachmentTitle params Assign ', error)
                        }
                      }
                    })
                  } catch (error) {
                    sendResponse('FAILURE', 'ERR-HAN-40621', 'Error in _GetAttachmentTitle', error)
                  }
                }
              })
              
          } catch (error) {
            return sendResponse(prepareErrorData('FAILURE', 'Error Code', 'Catch Error in GetProcessToken function'));
          }
      });
      } catch (error) {
        sendResponse('FAILURE', 'ERR-HAN-40622', 'Error in GetTranDBConn', error)
      }
      // Common object for send response
      function sendResponse(status, errorCode, errorMessage, errorObject) {
        var obj = {};
        if (status == 'SUCCESS') {
          reqTranDBHelper.Commit(mTranDB, true, function callbackres(res) {
            obj = {
              'STATUS': status,
              'ERROR_CODE': errorCode,
              'ERROR_MESSAGE': errorMessage,
              'ERROR_OBJECT': errorObject
            };
            pCallback(obj)
          });

        } else {
          if (mTranDB) {
            reqTranDBHelper.CallRollback(mTranDB);
          }
          obj = {
            'STATUS': status,
            'ERROR_CODE': errorCode,
            'ERROR_MESSAGE': errorMessage,
            'ERROR_OBJECT': errorObject
          }
          pCallback(obj)
        }

      }

    })
  } catch (error) {
    sendErrorResponse('FAILURE', 'ERR-HAN-40623', 'Error in ScanSaveContent', error)
  }

  // Common object for send response
  function sendErrorResponse(status, errorCode, errorMessage, errorObject) {
    var obj = {
      'STATUS': status,
      'ERROR_CODE': errorCode,
      'ERROR_MESSAGE': errorMessage,
      'ERROR_OBJECT': errorObject
    }
    pCallback(obj)
  }

  // To print information messages to log
  function _PrintInfo(pMessage) {
    reqInstanceHelper.PrintInfo(strServiceName, pMessage, objLogInfo)
  }

  // Success callback for client
  function successcallback(strResult) {
    pCallback(strResult)
  }
}

module.exports = {
  ScanSaveContent: ScanSaveContent
}
/********** End of File ********/