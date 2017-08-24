'use strict';

const firebaseError = require('../models/firebase-error');
const user = require('../models/firebase-user');
const constants = require('./constants');
const rp = require('request-promise');

exports.callEndpoint = function(method, url, data, callback){
	var options = { method: method, uri:url }
	if (data && method.toLowerCase().trim() == 'post'){
		options.body = data;
		options.json = true;
	}
	 
	if (!callback || typeof(callback) !== 'function')
		return rp(options);

	rp(options)
		.then(function (successResponse) {
	        callback(null, successResponse);
	    })
	    .catch(function (errorResponse) {
			callback(errorResponse);
	    });
}

exports.invalidArgumentError = function(argument) {
	return new firebaseError(constants.errorCodes.INVALID_ARGUMENT_ERROR, "Invalid or missing field: " + argument);
};

exports.processFirebaseAuthResult = function(firebaseAuthResult){
	var now = new Date().getTime();
	var expiry = (firebaseAuthResult.expiresIn - 60) * 1000; //minus 60 seconds for network lag

	var authResult = {
		token: firebaseAuthResult.idToken,
		userId: firebaseAuthResult.localId,
		created: now,
		expires: now + expiry,
		refreshToken: firebaseAuthResult.refreshToken
	}

	if (firebaseAuthResult.providerId && firebaseAuthResult.providerId.toLowerCase() !== 'password')
		authResult.user = new user.social_user(firebaseAuthResult);
	else
		authResult.user = new user.user(firebaseAuthResult);

	return authResult;
}

exports.processFirebaseRefreshTokenResult = function(firebaseAuthResult){
	var now = new Date().getTime();
	var expiry = (firebaseAuthResult.expiresIn - 60) * 1000; //minus 60 seconds for network lag

	var authResult = {
		token: firebaseAuthResult.idToken,
		userId: firebaseAuthResult.user_id,
		created: now,
		expires: now + expiry,
		refreshToken: firebaseAuthResult.refreshToken
	}

	if (firebaseAuthResult.providerId && firebaseAuthResult.providerId.toLowerCase() !== 'password')
		authResult.user = new user.social_user(firebaseAuthResult);
	else
		authResult.user = new user.user(firebaseAuthResult);

	return authResult;
}

exports.processFirebaseError = function(error) {
	//format for errors from firebase
	//var errorData = new { error = new { code = 0, message = "errorid" } };

	var errorCode = "UNKNOWN_ERROR";
	var errorMessage = "Some error occurred";
	var originalError = error;
	if (error.error.error)
		originalError = error.error.error;
	else if (error.error)
		originalError = error.error;

	if (error && error.error && error.error.error){
		//valid error from firebase, check for message
		errorCode = error.error.error.message;

		switch (error.error.error.message)
		{
		    //general errors
		    case "invalid access_token, error code 43.":
		        errorCode = "InvalidAccessToken";
		        errorMessage = "Invalid access token";
		        break;

		    case "CREDENTIAL_TOO_OLD_LOGIN_AGAIN":
		        errorMessage = "You need to login again";
		        break;

		    //possible errors from Third Party Authentication using GoogleIdentityUrl
		    case "INVALID_PROVIDER_ID : Provider Id is not supported.":
		        errorCode = "INVALID_PROVIDER_ID";
		        errorMessage = "Provider Id is not supported";
		        break;
		    case "MISSING_REQUEST_URI":
		        errorMessage = "Invalid request. REquest url is missing";
		        break;
		    case "A system error has occurred - missing or invalid postBody":
		        errorCode = "INVALID_REQUEST_BODY";
		        errorMessage = "Missing or invalid postBody";
		        break;

		    //possible errors from Email/Password Account Signup (via signupNewUser or setAccountInfo) or Signin
		    case "INVALID_EMAIL":
		        errorMessage = "Email address not valid";
		        break;
		    case "MISSING_PASSWORD":
		        errorMessage = "Password not provided";
		        break;

		    //possible errors from Email/Password Account Signup (via signupNewUser or setAccountInfo)
		    case "WEAK_PASSWORD : Password should be at least 6 characters":
		    	errorCode = "WEAK_PASSWORD";
		        errorMessage = "Password should be at least 6 characters";
		        break;
		    case "EMAIL_EXISTS":
		        errorMessage = "A user already exists with this email address";
		        break;
		        
		    //possible errors from Account Delete
		    case "USER_NOT_FOUND":
		        errorMessage = "User account does not exist";
		        break;

		    //possible errors from Email/Password Signin
		    case "INVALID_PASSWORD":
		        errorMessage = "Password is incorrect";
		        break;
		    case "EMAIL_NOT_FOUND":
		        errorMessage = "No user account exists with that email";
		        break;
		    case "USER_DISABLED":
		        errorMessage = "User account is disabled";
		        break;

		    //possible errors from Email/Password Signin or Password Recovery or Email/Password Sign up using setAccountInfo
		    case "MISSING_EMAIL":
		        errorMessage = "Email not provided";
		        break;

		    //possible errors from Password Recovery
		    case "MISSING_REQ_TYPE":
		        errorMessage = "Password recovery type not set";
		        break;

		    //possible errors from Account Linking
		    case "INVALID_ID_TOKEN":
		        errorMessage = "Token is invalid";
		        break;

		    //possible errors from Getting Linked Accounts
		    case "INVALID_IDENTIFIER":
		        errorMessage = "Unknown or invalid identifier";
		        break;
		    case "MISSING_IDENTIFIER":
		        errorMessage = "Indentifier not provided";
		        break;
		    case "FEDERATED_USER_ID_ALREADY_LINKED":
		        errorMessage = "Account has already been linked";
		        break;
		}
	}
	else if (error.error){
		//not firebase error!

		if (error.error){
			switch (error.error.code){
				//internet error on server or resource not available(?)
				case "ENOENT":
				case "ENOTFOUND":
					errorCode = "NETWORK";
					errorMessage = "Remote host is unreachable";
					break;
			}
		}		
	}

	return new firebaseError(errorCode, errorMessage, originalError);
};