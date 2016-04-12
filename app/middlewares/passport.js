let LocalStrategy = require('passport-local').Strategy
let passport = require('passport')
let wrap = require('nodeifyit')
let User = require('../models/user')
let FacebookStrategy = require('passport-facebook').Strategy
let GoogleStrategy = require('passport-google-oauth2').Strategy
let TwitterStrategy = require('passport-twitter').Strategy

// Handlers
async function localAuthHandler(email, password) {
    let user = await User.promise.findOne({'local.email': email})

    if (!user || email !== user.local.email) {
        return [false, {message: 'Invalid username'}]
    }

    if (!await user.validatePassword(password)) {
        return [false, {message: 'Invalid password'}]
    }
    return user
}

async function localSignupHandler(email, password) {

    email = (email || '').toLowerCase()
    // Is the email taken?
    if (await User.promise.findOne({'local.email': email})) {
        return [false, {message: 'That email is already taken.'}]
    }

    // create the user
    let user = new User().local;
    user.email = email
    // Use a password hash instead of plain-text
    user.password = await user.generateHash(password)
    return await user.save()
}

// 3rd-party Auth Helper
function loadPassportStrategy(OauthStrategy, config, userField) {
    config.passReqToCallback = true
    passport.use(new OauthStrategy(config, wrap(authCB, {spread: true})))

    async function authCB(req, token, _ignored_, account) {
        console.log("req.user ", req.user)
        if (userField === 'facebook') {
            let userFB = await User.promise.findOne({'facebook.id': account.id})
            if (userFB) return userFB;
            if (req.user) {
                if (!req.user.facebook.id && !userFB) {
                    console.log('Save the user')
                    let user = await User.promise.findById(req.user._id)
                    user.facebook.id = account.id
                    user.facebook.token = token
                    user.facebook.name = account.name.givenName + ' ' + account.name.familyName;
                    user.facebook.email = account.emails[0].value
                    return await user.save()
                }
            }
            else {
                console.log('Creating the account')
                let user = new User()
                user.facebook.id = account.id
                user.facebook.token = token
                user.facebook.email = account.emails[0].value
                user.facebook.name = account.name.givenName + ' ' + account.name.familyName;
                return await user.save()


            }
        } else if (userField === 'twitter') {
            let twitterUser = await User.promise.findOne({'twitter.id': account.id})
            if (twitterUser) return twitterUser
            if (req.user) {
                if (!req.user.twitter.id && !twitterUser) {
                    let user = await User.promise.findById(req.user._id)
                    user.twitter.id = account.id
                    user.twitter.token = token
                    user.twitter.username = account.username
                    user.twitter.displayName = account.displayName
                    return await user.save()
                }
            } else {
                let user = new User()
                user.twitter.id = account.id
                user.twitter.token = token
                user.twitter.username = account.username
                user.twitter.displayName = account.displayName
                return await user.save()

            }

        } else if (userField === 'google') {
            let googleUser = await User.promise.findOne({'google.id': account.id})
            if (googleUser) return googleUser
            if (req.user) {
                if (!req.user.google.id && !googleUser) {
                    let user = await User.promise.findById(req.user._id)
                    user.google.id = account.id
                    user.google.token = token
                    user.google.email = account.emails[0].value
                    user.google.name = account.displayName
                    return await user.save()
                }
            }
            else {
                let user = new User()
                user.google.id = account.id
                user.google.token = token
                user.google.email = account.emails[0].value
                user.google.name = account.displayName
                return await user.save()

            }
        }
    }
}

function configure(CONFIG) {
    // Required for session support / persistent login sessions
    passport.serializeUser(wrap(async (user) => user._id))
    passport.deserializeUser(wrap(async (id) => {
        User.promise.findById(id)
        return await User.promise.findById(id)
    }))

    /**
     * Local Auth
     */
    let localStrategy = new LocalStrategy({
        usernameField: 'email', // Use "email" instead of "username"
        failureFlash: true // Enable session-based error logging
    }, wrap(localAuthHandler, {spread: true}))

    let localSignupStrategy = new LocalStrategy({
        usernameField: 'email',
        failureFlash: true
    }, wrap(localSignupHandler, {spread: true}))

    passport.use('local-login', localStrategy)
    passport.use('local-signup', localSignupStrategy)

    /**
     * 3rd-Party Auth
     */

        // loadPassportStrategy(LinkedInStrategy, {...}, 'linkedin')
        //loadPassportStrategy(FacebookStrategy, {...}, 'facebook')
        // loadPassportStrategy(GoogleStrategy, {...}, 'google')
        // loadPassportStrategy(TwitterStrategy, {...}, 'twitter')
    loadPassportStrategy(FacebookStrategy, {
        clientID: CONFIG.auth["facebook"].consumerKey,
        clientSecret: CONFIG.auth["facebook"].consumerSecret,
        callbackURL: CONFIG.auth["facebook"].callbackUrl,
        profileFields: ['id', 'email', 'gender', 'link', 'locale', 'name', 'timezone', 'updated_time', 'verified']
    }, 'facebook')

    loadPassportStrategy(TwitterStrategy, {
        consumerKey: CONFIG.auth["twitter"].consumerKey,
        consumerSecret: CONFIG.auth["twitter"].consumerSecret,
        callbackURL: CONFIG.auth["twitter"].callbackUrl
    }, 'twitter')

    loadPassportStrategy(GoogleStrategy, {
        clientID: CONFIG.auth["google"].clientID,
        clientSecret: CONFIG.auth["google"].clientSecret,
        callbackURL: CONFIG.auth["google"].callbackUrl
    }, 'google')
    return passport
}


module.exports = {passport, configure}