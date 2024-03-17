/*  Created BY      :Udhaya
    Created Date    :29-jun-2016
    Purpose         :Get  Designer Url for free signup
    */

// Require dependencies
var modPath = '../../../../node_modules/'
var reqExpress = require(modPath + 'express');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var router = reqExpress.Router();
var mClient = '';
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
//Host APi
router.post('/GetPlatfromDesignerUrl', function (req, resp, next) {
    var pHeaders = '';
    var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.query, req);
    objLogInfo.PROCESS = 'GetPlatfromDesignerUrl-Authentication';
    objLogInfo.ACTION = 'GetPlatfromDesignerUrl';
    reqLogWriter.Eventinsert(objLogInfo);

    try {
        pHeaders = req.headers;
        DBInstance.GetFXDBConnection(pHeaders, 'plt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
            //reqCasInstance.GetCassandraConn(pHeaders, 'plt_cas', function Callback_GetCassandraConn(pClient) {
            mClient = pClient;
            reqLogWriter.TraceInfo(objLogInfo, 'GetPlatfromDesignerUrl Called...');
            //Prepare query
            const PLTSETUP = "select value from platform_setup where code='PLATFORM_DESIGNER_URL'";

            //Declate Variable
            var strPltrslt = [];
            var objUrl = {};

            //Functioncall
            GetPlatformDesignerUrl();

            //Prepare function
            function GetPlatformDesignerUrl() {
                try {
                    DBInstance.GetTableFromFXDB(mClient, 'platform_setup', ['value'], {
                        'code': PLATFORM_DESIGNER_URL
                    }, objLogInfo, function callbackPLTSETUP(err, pResult) {
                        // mClient.execute(PLTSETUP, [], {
                        //     prepare: true
                        // }, function callbackPLTSETUP(err, pResult) {
                        try {
                            if (err)
                                reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10141");

                            else {
                                strPltrslt = pResult.rows[0].value
                            }
                            if (strPltrslt.length > 0) {
                                objUrl.Result = 'SUCCESS';
                                objUrl.ErrorMessage = '';
                                objUrl.DesignerUrl = strPltrslt;
                            } else {
                                objUrl.Result = 'FAILURE';
                                objUrl.ErrorMessage = 'Platform Designer Url setup is mising...';
                                objUrl.DesignerUrl = '';
                                reqLogWriter.TraceInfo(objLogInfo, 'Platform Designer Url setup is mising...');
                            }

                            //send response to client
                            reqLogWriter.TraceInfo(objLogInfo, 'GetPlatfromDesignerUrl loaded...');
                            reqLogWriter.EventUpdate(objLogInfo);
                            resp.send(JSON.stringify(objUrl));

                        } catch (error) {
                            errorHandler("ERR-FX-10141", "Error GetPlatfromDesignerUrl function" + error)
                        }
                    })
                } catch (error) {
                    errorHandler("ERR-FX-10140", "Error GetPlatfromDesignerUrl function" + error)
                }
            }


            function errorHandler(errcode, message) {
                console.log(message, errcode);
                reqLogWriter.TraceError(objLogInfo, message, errcode);
            }
        })
    } catch (error) {
        errorHandler("ERR-FX-10142", "Error GetPlatfromDesignerUrl function" + error)
    }
});



module.exports = router;
//*******End of Serive*******//