/* 
 * Description     : created for calling WFSelectHelper and WFUpdateHelper from validation framework
*/

// Require dependencies
var reqWFSelectHlpr = require('../../torus-references/common/serviceHelper/WFSelectHelper');
var reqWFUpdateHelper = require('../../torus-references/common/serviceHelper/WFUpdateHelper');

// Call wfselect for BULK_UPDATE case
function WFSelect(pParams, pTranDB, pCasIns, pLogInfo, pReqHeader, CallbackWFselect) {
    var RecordsperPage = 0
    var SearchInfo = []
    pParams['BULK_UPDATE'] = 'Y'
    reqWFSelectHlpr.WFSelect(RecordsperPage, SearchInfo, pParams, pParams, pTranDB, pCasIns, null, pLogInfo, pReqHeader, CallbackWFselect);
}

// Call the wfupdate core function
function WFUpdate(pCasIns, pTranDB, pAppId, pTokenId, pUId, pDTCode, pDTTCode, pWftpaId, pEventCode, pDSCode, pLogInfo, pReqHeader, pCallback) {
    var strAppSTSId = '',
        strSTSId = '',
        strAppRoles = '',
        strStpcId = '',
        strNeedComment = '',
        strComment = '',
        strLoginName = '',
        strAppUId = '',
        strSystemDesc = '',
        strSCode = '',
        strDTCode = pDTCode,
        strDTTCode = pDTTCode,
        strWftpaId = pWftpaId,
        strEventCode = pEventCode,
        strDSCode = pDSCode,
        strAppId = pAppId,
        strTokenId = pTokenId,
        strUId = pUId;
    //added params for WFUpdate
    reqWFUpdateHelper.WFUpdate(strDTCode, strDTTCode, strWftpaId, strEventCode, strDSCode, strAppId, strTokenId, strUId, strAppSTSId, strSTSId, strAppRoles, new Date(), strStpcId, strNeedComment, strComment, pTranDB, pCasIns, strLoginName, strAppUId, strSystemDesc, strSCode, pLogInfo, pReqHeader, '', '', '', '', function callbackWFUpdate(pStatus, pMessage) {
        pCallback()
    });
}

module.exports = {
    WFSelect: WFSelect,
    WFUpdate: WFUpdate
}
/********** End of File ********/