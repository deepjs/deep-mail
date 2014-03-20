var nodemailer = require("nodemailer"),
	deep = require("deepjs");

var closure = {};

deep.mail = function(params, datas, transporter, closeAfter){
	transporter = transporter || deep.context["deep-mail-transporter"] || closure.transporter;
	if(!transporter)
		return deep.errors.Email("You need to define an email transporter before sending email.");
	return transporter.send(params, datas, closeAfter);
};

deep.mail.defaultTransporter = function(transporter){
	closure.transporter = transporter;
	return transporter;
};

function defaultPreparation (params, datas){
	params = deep.utils.copy(params);
	var promises = [];
	if(params.text && typeof params.text === "string")
	{
		if(datas)
			params.text = deep.utils.interpret(params.text, datas);
		promises.push(deep.get(params.text));
	}
	if(params.html && typeof params.html === "string")
	{
		if(datas)
			params.html = deep.utils.interpret(params.text, datas);
		promises.push(deep.get(params.html));
	}
	if(promises.length > 0)
		return deep.all(promises)
		.done(function(res){
			var tmp = res.shift();
			if(params.text)
			{
				if(typeof tmp === 'function')
					params.text = tmp(datas);
				else
					params.text = tmp;
				tmp = res.shift();
			}
			if(typeof tmp === 'function')
				params.html = tmp(datas);
			else if(params.html)
				params.html = tmp;
			return params;
		});
	if(!params.text)
		if(datas)
			params.text = JSON.stringify(datas);
		else
			params.text  = "no text.";
	if(typeof params.text === 'function')
		params.text = params.text(datas);
	if(typeof params.html === 'function')
		params.html = params.html(datas);
	return params;
};

deep.mail.nodemailer = function(type, config){
	var transporter = {
		handler:nodemailer.createTransport(type, config),
		prepare:defaultPreparation,
		send:function(params, datas, closeAfter)
		{
			var self = this;
			return deep.when(this.prepare(params, datas))
			.done(function(params){
				var def = deep.Deferred();
				self.handler.sendMail(params, function(error, response){
				    if(error)
				        def.reject(error);
				    else
				        def.resolve(response.message);
				    if(closeAfter)
				    	transporter.close();
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
		prepare:function(params, datas){
			defaultPreparation(params, datas);
			return {
				From: params.from, 
		        To: params.to, 
		        Subject: params.subject, 
		        TextBody: params.text,
		        Attachements:params.attachments
			};
		},
		send:function(params, datas)
		{
			var self = this;
			return deep.when(this.prepare(params, datas))
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

deep.Chain.add("mail", function(params, transporter, closeAfter) {
	var self = this;
	var func = function() {
		return deep.mail(params, deep.chain.val(self), transporter, closeAfter);
	};
	func._isDone_ = true;
	addInChain.call(this, func);
	return self;
});

module.exports = deep.mail;