var nodemailer = require("nodemailer"),
	postmark = require("postmark")
	deep = require("deepjs");

deep.errors.Mail = function(msg, report, fileName, lineNum) {
    if (typeof msg === 'object')
        report = msg;
    if (!msg)
        msg = "EmailError";
    return this.Error(500, msg, report, fileName, lineNum);
};

var closure = {}; // will hold defaultTransporter

deep.mail = function(params, datas, transporter, closeAfter){
	var promises = [];
	if(transporter && transporter._deep_ocm_)
		transporter = transporter();
	if(params && params._deep_ocm_)
		params = params();
	if(datas && datas._deep_ocm_)
		datas = datas();
	if(typeof params === 'string')	// load params through protocols
		promises.push(deep.get(params));
	if(typeof datas === 'string')	// load datas through protocols
		promises.push(deep.get(datas));
	if(typeof transporter === 'string')	// load transporter through protocols
		promises.push(deep.get(transporter));
	if(promises.length > 0)
		return deep.all(promises)
		.done(function(results){
			if(typeof params === 'string')
				params = results.shift();
			if(typeof datas === 'string')
				datas = results.shift();
			if(typeof transporter === 'string')
				transporter = results.shift();
			if(params && params._deep_ocm_)
				params = params();
			if(datas && datas._deep_ocm_)
				datas = datas();
			transporter = transporter || deep.context("mail-transporter") || closure.transporter;
			if(!transporter)
				return deep.errors.Mail("You need to define an email transporter before sending email.");
			if(transporter._deep_ocm_)
				transporter = transporter();
			return transporter.send(params, datas, closeAfter);
		});
	transporter = transporter || deep.context("mail-transporter") || closure.transporter;
	if(!transporter)
		return deep.when(deep.errors.Mail("You need to define an email transporter before sending email."));
	return transporter.send(params, datas, closeAfter);
};

deep.Promise._up({
	mail : function(params, transporter, closeAfter) {
		var func = function(s) {
			return deep.mail(params, deep.utils.nodes.val(s), transporter, closeAfter);
		};
		func._isDone_ = true;
		return this._enqueue(func);
	}
});

deep.mail.defaultTransporter = function(transporter){
	closure.transporter = transporter;
	return transporter;
};

function defaultPreparation (params, datas){
	params = deep.utils.copy(params);
	var promises = [];

	// try to interpret 'text' string with datas, then try to retrieve it (if a protocol is present)
	if(typeof params.text === "string")	
	{
		if(datas)
			params.text = deep.utils.interpret(params.text, datas);
		promises.push(deep.get(params.text));
	}
	// try to interpret 'html' string with datas, then try to retrieve it (if a protocol is present)
	if(typeof params.html === "string")
	{
		if(datas)
			params.html = deep.utils.interpret(params.text, datas);
		promises.push(deep.get(params.html));
	}

	// samething for params.to : great for retrieving bunch of adresses from ressources
	if(typeof params.to === 'string')
	{
		if(datas)
			params.html = deep.utils.interpret(params.to, datas);
		promises.push(deep.get(params.to));
	}

	if(promises.length > 0) // have something to load
		return deep.all(promises)
		.done(function(res){
			var tmp = res.shift();
			if(typeof params.text === "string")
			{
				// if 'text' is function : use it to render datas
				if(tmp._deep_ocm_)
					tmp = tmp();
				if(typeof tmp === 'function')	
					params.text = tmp(datas);
				else 
					params.text = tmp; // or use loaded or provided 'text' string
				tmp = res.shift();
			}
			// if 'html' is function : use it to render datas
			if(typeof params.html === "string")
			{
				if(tmp._deep_ocm_)
					tmp = tmp();
				if(typeof tmp === 'function')
					params.html = tmp(datas);
				else 
					params.html = tmp; // or use loaded or provided 'html' string
				tmp = res.shift();
			}
			if(tmp)	// 'to' is a string
			{
				if(tmp._deep_ocm_)
					tmp = tmp();
				if(typeof tmp === 'function')
					params.to = tmp(datas);
				else if(params.to)
					params.to = tmp; 
			}
			return params;			// return final, prepared, params
		});
	// no loads
	if(!params.text) // construct default 'text'
		if(datas)
			params.text = JSON.stringify(datas);	
		else
			params.text  = "no text.";
	if(params.text._deep_ocm_)
		params.text = params.text();
	if(typeof params.text === 'function')	// use function to render datas
		params.text = params.text(datas);
	if(params.html._deep_ocm_)
		params.html = params.html();
	if(typeof params.html === 'function')	// use function to render datas
		params.html = params.html(datas);
	return params;  // return final, prepared, params
};

var recursePromises = function(params){
	// look after any promises in 'text','html','to' : if so : wait for them and catch results
	if(params.to.then || (params.text && params.text.then) || (params.html && params.html.then))
		return deep.all(params.text, params.html, params.to)
		.done(function(results){
			params.text = results[0];
			params.html = results[1];
			params.to = results[2];
			return params;
		});
};

//_____________________________________ TRANSPORTERS

deep.mail.nodemailer = function(type, config){
	var transporter = {
		handler:nodemailer.createTransport(type, config),
		prepare:defaultPreparation,
		send:function(params, datas, closeAfter)
		{
			var self = this;
			return deep.when(this.prepare(params, datas))
			.done(recursePromises)
			.done(function(params){
				var def = deep.Deferred();
				self.handler.sendMail(params, function(error, success){
				    if(error)
				        def.reject(error);
				    else
				        def.resolve(success);
				    if(closeAfter)
				    	self.handler.close();
				});
				return def.promise();
			});
		}
	};
	return transporter;
};

deep.mail.postmark = function(APIKEY){
	var transporter = {
		handler:postmark(APIKEY),
		prepare:defaultPreparation,
		send:function(params, datas)
		{
			var self = this;
			return deep.when(this.prepare(params, datas))
			.done(recursePromises)
			.done(function(params){
				// transform params structure from nodemailer style to postmark style
				return {
					From: params.from, 
			        To: params.to, 
			        Subject: params.subject, 
			        TextBody: params.text,
			        Attachements:params.attachments
				};
			})
			.done(function(params){
				var def = deep.Deferred();
				self.handler.send(params, function(error, success){
				    if(error)
				        def.reject(error);
				    else
				        def.resolve(success);
				});
				return def.promise();
			});
		}
	};
	return transporter;
};

module.exports = deep.mail;