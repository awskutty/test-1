/*
    @Service name       : Authentication,
    @Description        : This is a main file for all api calls in this service,
    @Number of API's    : 49
*/

// Require dependencies
var reqInstanceHelper = require('../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../torus-references/instance/DBInstance');
var servicePath = 'Authentication';

// Include the cluster module
var reqCluster = require('cluster');
// Code to run if we're in the master process
if (!reqCluster.isMaster) {
    // Count the machine's CPUs
    var cpuCount = require('os').cpus().length;
    // Create a worker for each CPU
    for (var i = 0; i < cpuCount; i += 1) {
        reqCluster.fork();
    }
    // Listen for dying workers
    reqCluster.on('exit', function (worker) {
        // Replace the dead worker, we're not sentimental
        console.log('Worker %d died :(', worker.id);
        reqCluster.fork();
    });
    // Code to run if we're in a worker process
} else {
    var reqEvents = require('events');
    var reqAppHelper = require('../../../torus-references/instance/AppHelper');

    var objEvents = new reqEvents();
    objEvents.on('EventAfterInit', AfterInitDBListener);
    process.title = 'Torus_Svc_Authentication';
    // reqAppHelper.LoadAllInstanses(servicePath, function (pResult) {
    //     if (pResult == 'SUCCESS') {
    //         reqInstanceHelper.PrintInfo(servicePath, 'Instances loaded successfully.', null);
    //         objEvents.emit('EventAfterInit');
    //     }
    // });


    reqInstanceHelper.GetConfig('SERVICE_MODEL', function (ResSvcModel) {
        reqDBInstance.LoadServiceModel('SERVICE_MODEL', JSON.parse(ResSvcModel), function (res) {
            reqInstanceHelper.PrintInfo(servicePath, 'Instances loaded successfully.', null);
            objEvents.emit('EventAfterInit');
        });
    })

    function AfterInitDBListener() {
        var arrRoutes = [];
        var reqGetClientId = require('./routes/GetClientId');
        var reqClearCache = require('./routes/ClearCache');
        var reqSSORedirect = require('./routes/SSORedirect');
        var reqGetLoginData = require('./routes/GetLoginData');
        var reqGetSSOInfo = require('./routes/GetSSOInfo');
        var reqimportTables = require('./routes/importTables');
        var reqexportTables = require('./routes/exportTables');
        var reqGetLoginPageInfo = require('./routes/GetLoginPageInfo');
        var reqSaveComment = require('./routes/SaveComment');
        var reqDeleteComment = require('./routes/DeleteComment');
        var reqLoadComments = require('./routes/LoadComments');
        var reqLoadLanguageGroupKey = require('./routes/LoadLanguageGroupKey');
        var reqInsertStaticlang = require('./routes/InsertStaticlang');
        var reqUpdateLD = require('./routes/UpdateLD');
        var reqLoadLD = require('./routes/LoadLD');
        var reqPing = require('./routes/Ping');
        var reqGetAppInfo = require('./routes/GetAppInfo');
        var reqCPLogin = require('./routes/CPLogin');
        var reqAPLogin = require('./routes/APLogin');
        var reqLoadSubscriberDetails = require('./routes/LoadSubscriberDetails');
        var reqAdminLogoff = require('./routes/AdminLogoff');
        var reqChangePassword = require('./routes/ChangePassword');
        var reqClearWPUserSessions = require('./routes/ClearWPUserSessions');
        var reqDoClientLogoff = require('./routes/DoClientLogoff');
        var reqClearPlatformSessions = require('./routes/ClearPlatformSessions');
        var reqSaveDisclaimerMessage = require('./routes/SaveDisclaimerMessage');
        var reqAPCreateUser = require('./routes/APCreateUser');
        var reqGetAPUserRole = require('./routes/GetAPUserRole');
        var reqGetPlatfromDesignerUrl = require('./routes/GetPlatfromDesignerUrl');
        var reqGetApassComponents = require('./routes/GetApassComponents');
        var reqGetLangJson = require('./routes/GetLangJson');
        var reqWPLogoff = require('./routes/WPLogoff');
        var reqGetWFInfo = require('./routes/GetWFInfo');
        var reqAPAdminSignin = require('./routes/APAdminSignin');
        var reqGetCltPwdPolicy = require('./routes/GetCltPwdPolicy');
        var reqCltNewPwd = require('./routes/CltNewPwd');
        var reqCltChangePwd = require('./routes/CltChangePwd');
        var reqGetPltNewPwd = require('./routes/GetPltNewPwd');
        var reqPltChangePwd = require('./routes/PltChangePwd');
        var reqGetPltPwdPolicy = require('./routes/GetPltPwdPolicy');
        var reqUnlockUser = require("./routes/UnlockUser");
        var reqCheckOTP = require('./routes/CheckOTP');
        var reqDoPlatformClientSignUp = require('./routes/DoPlatformClientSignUp');
        var reqLoadPlatformUsers = require('./routes/LoadPlatformUsers');
        var reqSavePlatformUser = require('./routes/SavePlatformUser');
        var reqDeletePlatformUser = require('./routes/DeletePlatformUser');
        var reqValidateSessionPassword = require('./routes/ValidateSessionPassword');
        var reqSendForgotPwdOTP = require("./routes/SendForgotPwdOTP");
        var reqCltForgotPwd = require("./routes/CltForgotPwd");
        var reqPltForgotPwd = require('./routes/PltForgotPwd');
        var reqActivatePayAccount = require('./routes/ActivatePayAccount');
        var reqActivateFreeAccount = require('./routes/ActivateFreeAccount');
        var reqGetClientTheme = require('./routes/GetClientTheme');
        var reqGetAPUsers = require('./routes/GetAPUsers');
        var reqGetDisclaimerMessage = require('./routes/GetDisclaimerMessage');
        // var reqClientDeploy = require('./routes/ClientDeploy');
        var reqSearchLogDetails = require('./routes/SearchLogDetails');
        var reqWPGetAppSysInfo = require('./routes/WPGetAppSysInfo');
        var reqWPSimpleLogin = require('./routes/WPSimpleLogin');
        var reqLoadParamsConfig = require('./routes/LoadParamsConfig');
        var reqSaveParamsConfig = require('./routes/SaveParamsConfig');
        var reqSaveScanConfig = require('./routes/SaveScanConfig');
        var reqDeleteParamsConfig = require('./routes/DeleteParamsConfig');
        var reqExportTenantSetup = require('./routes/ExportTenantSetup');
        var reqImportTenantSetup = require('./routes/ImportTenantSetup');
        var reqLoadBackup = require('./routes/LoadBackup');
        var reqRestoreBackup = require('./routes/RestoreBackup');
        var GetCaptcha = require('./routes/GetCaptcha');
        var reqCaptchaValidation = require('./routes/reCaptchaValidation');
        var Gettenantsetup = require('./routes/Gettenantsetup');
        var GetLanguage = require('./routes/GetLanguage');
        var GetErrorCategory = require('./routes/GetErrorCategory');
        var GetErrorCode = require('./routes/GetErrorCodes');
        var reqappUserSystemDetail = require('./routes/WPGetAppurStsDetail');
        var reqClearLogDetails = require('./routes/ClearLogDetails');
        var reqDownloadLogDetails = require('./routes/DownloadLogDetails');
        var reqSendLogAsMail = require('./routes/SendLogAsMail');
        var reqGetsalt = require('./routes/GetSalt');
        var reqGetTableData = require('./routes/GetTableData');
        var reqGetAppLevelCss = require('./routes/GetAppLevelCss');
        var SendOTP = require('./routes/SendOtp');
        var OTPVerification = require('./routes/OTPVerification');
        var SaveCodeSnippets = require('./routes/SaveCodeSnippets');
        var LoadCodeSnippets = require('./routes/LoadCodeSnippets');
        var reqGeClusInfo = require('./routes/GetClusterInfo');

        var reqsavesetup = require('./routes/SaveSetupConfig');
        var reqoverrideSetup = require('./routes/LoadOverrideSetup');
        var requpdateoverrideSetup = require('./routes/UpdateOverRideSetup');
        var reqSaveuseraccessLog = require('./routes/SaveUserAccessLog');
        var reqLoadUserPreferences = require('./routes/LoadUserPreferences');
        var reqSaveUserPreferences = require('./routes/SaveUserPreferences');
        var reqRemoveFavorites = require('./routes/RemoveFavorites');
        var reqLoadApplnRoles = require('./routes/LoadApplicationRoles');
        var reqEncryptDepcrypt = require('./routes/EncryptDecrypt');
        var reqUpdateFavorites = require('./routes/UpdateFavorites');
        var reqGetCachekeys = require('./routes/GetCachekeys');
        var reqGetRedisKeys = require('./routes/GetRedis');
        var reqAddRedisKey = require('./routes/AddRedisKey');

        arrRoutes.push(reqGetCachekeys);
        arrRoutes.push(reqUpdateFavorites);
        arrRoutes.push(reqRemoveFavorites);
        arrRoutes.push(reqSaveUserPreferences);
        arrRoutes.push(reqLoadUserPreferences);
        arrRoutes.push(reqSaveuseraccessLog);
        arrRoutes.push(reqGetClientId);
        arrRoutes.push(reqGeClusInfo);
        arrRoutes.push(LoadCodeSnippets);
        arrRoutes.push(SaveCodeSnippets);
        arrRoutes.push(OTPVerification);
        arrRoutes.push(SendOTP);
        arrRoutes.push(reqClearCache);
        arrRoutes.push(reqimportTables);
        arrRoutes.push(reqexportTables);
        arrRoutes.push(reqGetLoginPageInfo);
        arrRoutes.push(reqSaveComment);
        arrRoutes.push(reqDeleteComment);
        arrRoutes.push(reqLoadComments);
        arrRoutes.push(reqLoadLanguageGroupKey);
        arrRoutes.push(reqInsertStaticlang);
        arrRoutes.push(reqUpdateLD);
        arrRoutes.push(reqLoadLD);
        arrRoutes.push(reqPing);
        arrRoutes.push(reqGetAppInfo);
        arrRoutes.push(reqCPLogin);
        arrRoutes.push(reqAPLogin);
        arrRoutes.push(reqLoadSubscriberDetails);
        arrRoutes.push(reqAdminLogoff);
        arrRoutes.push(reqChangePassword);
        arrRoutes.push(reqClearWPUserSessions);
        arrRoutes.push(reqDoClientLogoff);
        arrRoutes.push(reqClearPlatformSessions);
        arrRoutes.push(reqSaveDisclaimerMessage);
        arrRoutes.push(reqAPCreateUser);
        arrRoutes.push(reqGetAPUserRole);
        arrRoutes.push(reqGetPlatfromDesignerUrl);
        arrRoutes.push(reqGetApassComponents);
        arrRoutes.push(reqGetLangJson);
        arrRoutes.push(reqWPLogoff);
        arrRoutes.push(reqGetWFInfo);
        arrRoutes.push(reqAPAdminSignin);
        arrRoutes.push(reqGetCltPwdPolicy);
        arrRoutes.push(reqCltNewPwd);
        arrRoutes.push(reqCltChangePwd);
        arrRoutes.push(reqGetPltNewPwd);
        arrRoutes.push(reqPltChangePwd);
        arrRoutes.push(reqGetPltPwdPolicy);
        arrRoutes.push(reqUnlockUser);
        arrRoutes.push(reqCheckOTP);
        arrRoutes.push(reqDoPlatformClientSignUp);
        arrRoutes.push(reqLoadPlatformUsers);
        arrRoutes.push(reqSavePlatformUser);
        arrRoutes.push(reqDeletePlatformUser);
        arrRoutes.push(reqValidateSessionPassword);
        arrRoutes.push(reqSendForgotPwdOTP);
        arrRoutes.push(reqCltForgotPwd);
        arrRoutes.push(reqPltForgotPwd);
        arrRoutes.push(reqActivatePayAccount);
        arrRoutes.push(reqActivateFreeAccount);
        arrRoutes.push(reqGetClientTheme);
        arrRoutes.push(reqGetAPUsers);
        arrRoutes.push(reqGetDisclaimerMessage);
        arrRoutes.push(reqSearchLogDetails);
        arrRoutes.push(reqWPGetAppSysInfo);
        arrRoutes.push(reqWPSimpleLogin);
        arrRoutes.push(reqLoadParamsConfig);
        arrRoutes.push(reqSaveParamsConfig);
        arrRoutes.push(reqSaveScanConfig);
        arrRoutes.push(reqDeleteParamsConfig);
        arrRoutes.push(reqExportTenantSetup);
        arrRoutes.push(reqImportTenantSetup);
        arrRoutes.push(reqLoadBackup);
        arrRoutes.push(reqRestoreBackup);
        arrRoutes.push(Gettenantsetup);
        arrRoutes.push(GetCaptcha);
        arrRoutes.push(GetLanguage);
        arrRoutes.push(reqCaptchaValidation);
        arrRoutes.push(GetErrorCategory);
        arrRoutes.push(GetErrorCode);
        arrRoutes.push(reqSSORedirect);
        arrRoutes.push(reqGetLoginData);
        arrRoutes.push(reqGetSSOInfo);
        arrRoutes.push(reqappUserSystemDetail);
        // arrRoutes.push(reqClientDeploy);
        arrRoutes.push(reqClearLogDetails);
        arrRoutes.push(reqDownloadLogDetails);
        arrRoutes.push(reqSendLogAsMail);
        arrRoutes.push(reqGetsalt);
        arrRoutes.push(reqGetTableData);
        arrRoutes.push(reqGetAppLevelCss);
        arrRoutes.push(reqsavesetup);
        arrRoutes.push(reqoverrideSetup);
        arrRoutes.push(requpdateoverrideSetup);
        arrRoutes.push(reqLoadApplnRoles);
        arrRoutes.push(reqEncryptDepcrypt);
        arrRoutes.push(reqGetRedisKeys);
        arrRoutes.push(reqAddRedisKey);
        reqAppHelper.StartService(servicePath, arrRoutes, __dirname);
    }
}
/******** End of File *******/