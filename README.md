deep-mail
===

deepjs wrapper for nodemailer.

For transporter config paraleters see nodemailer docs.

```javascript
	require("deep-mail")
	// configure default transporter
	.defaultTransporter("SMTP",{	
	    service: "Gmail",
	    auth: {
	        user: "gmail.user@gmail.com",
	        pass: "userpass"
	    }
	});

	//....

	deep.mail({	// use default transporter to send email
	    from: "Fred Foo ✔ <foo@blurdybloop.com>", // sender address
	    to: "bar@blurdybloop.com, baz@blurdybloop.com", // list of receivers
	    subject: "Hello ✔", // Subject line
	    text: "Hello world ✔", // plaintext body       
	    html: "<b>Hello world ✔</b>" // html body
	})
	.log();

	//...

	deep(myText)
	.email({	// use default transporter to send chain's value(s) (as JSON) through email
	    from: "Fred Foo ✔ <foo@blurdybloop.com>", // sender address
	    to: "bar@blurdybloop.com, baz@blurdybloop.com", // list of receivers
	    subject: "Hello ✔", // Subject line
	    //text: "Hello world ✔ : { value }", // plaintext body       ==> if you provides text here : it will be interpreted with chain's value(s) and used as email body
	    //html: "<b>Hello world ✔ : { value }</b>" // html body      ==> if you provide a template here (i.e. "swig::you-template.html") : it will be used with chain(s value(s) as context. else : it will be interpreted with chain's value(s)
	})
	.log();
```

You could use deep.context to manage contextualised transporter.
```javascript

	deep.when(...)
	.context("deep-mail-transporter", deep.mail.transporter("SMTP":{
		service: "Gmail",
		    auth: {
		        user: "gmail.user@gmail.com",
		        pass: "userpass"
		    }
	}))
	.done(function(){
		deep.mail({ ... }).log();
	});
```

deep.mail will first look after a 'deep-mail-transporter' property in deep.context before trying to use the default (general) one.


see deepjs docs on concurrent context management to fully grasp the utility of such manipulation



full API : 

```javascript

deep.mail(params, datas, transporter, closeAfter)...;

// and

deep(...).email(params, transporter, closeAfter)...;

```
