const CONFIG = require('../config')
let twitter = require('twitter')
let isLoggedIn = require('./middlewares/isLoggedIn')
let then = require('express-then')
var request = require('request');
var fb = require('fb');

module.exports = (app) => {
    let passport = app.passport

    app.get('/', (req, res) => res.render('index.ejs'))

    app.get('/profile', isLoggedIn, (req, res) => {
        res.render('profile.ejs', {
            user: req.user,
            message: req.flash('error')
        })
    })

    app.get('/logout', (req, res) => {
        req.logout()
        res.redirect('/')
    })

    app.get('/login', (req, res) => {
        res.render('login.ejs', {message: req.flash('error')})
    })

    app.get('/signup', (req, res) => {
        res.render('signup.ejs', {message: req.flash('error')})
    })

    // process the login form
    app.post('/login', passport.authenticate('local-login', {
        successRedirect: '/profile',
        failureRedirect: '/login',
        failureFlash: true
    }))

// process the signup form
    app.post('/signup', passport.authenticate('local-signup', {
        successRedirect: '/profile',
        failureRedirect: '/signup',
        failureFlash: true
    }))

    // Scope specifies the desired data fields from the user account
    let scope = ['email', 'user_posts', 'user_likes']

// Authentication route & Callback URL
    app.get('/auth/facebook', passport.authenticate('facebook', {scope: scope}))
    app.get('/auth/facebook/callback', passport.authenticate('facebook', {
        successRedirect: '/profile',
        failureRedirect: '/profile',
        failureFlash: true
    }))

// Authorization route & Callback URL
    app.get('/connect/facebook', passport.authorize('facebook', {scope: scope}))
    app.get('/connect/facebook/callback', passport.authorize('facebook', {
        successRedirect: '/profile',
        failureRedirect: '/profile',
        failureFlash: true
    }))

    let scopeTwitter = 'email'
    // Authentication route & Callback URL
    app.get('/auth/twitter', passport.authenticate('twitter', {scopeTwitter}))
    app.get('/auth/twitter/callback', passport.authenticate('twitter', {
        successRedirect: '/profile',
        failureRedirect: '/profile',
        failureFlash: true
    }))

    // Authentication route & Callback URL
    app.get('/connect/twitter', passport.authorize('twitter', {scopeTwitter}))
    app.get('/connect/twitter/callback', passport.authorize('twitter', {
        successRedirect: '/profile',
        failureRedirect: '/profile',
        failureFlash: true
    }))


    // Authentication route & Callback URL
    app.get('/auth/google', passport.authenticate('google', {
        scope: [
            'email', 'profile']
    }))
    app.get('/auth/google/callback', passport.authenticate('google', {
        successRedirect: '/profile',
        failureRedirect: '/profile',
        failureFlash: true
    }))

    // Authentication route & Callback URL
    app.get('/connect/google', passport.authorize('google', {
        scope: [
            'email', 'profile']
    }))
    app.get('/connect/google/callback', passport.authorize('google', {
        successRedirect: '/profile',
        failureRedirect: '/profile',
        failureFlash: true
    }))

    fb.options({
        appId: CONFIG.auth["facebook"].consumerKey,
        appSecret: CONFIG.auth["facebook"].consumerSecret,
        redirectUri: CONFIG.auth["facebook"].callbackUrl
    })

    app.get('/timeline', isLoggedIn, then(async (req, res) => {
            let alltweets = await getTwitterFeed(req)
            res.render('timeline.ejs', {
                posts: alltweets
            })
        }
    ))

    app.post('/twitter/reply/:id/:username', isLoggedIn, then(async (req, res) => {
        try {
            req.user.twitter;
            let twitterClient = getTwitterClient(req)
            let tweet_id = req.params.id
            let name = req.params.username
            let status = req.body.reply
            console.log(name)
            if (!status || status.length > 140) {
                return req.flash('error', "Not a valid tweet")
            }
            await twitterClient.promise.post('statuses/update', {
                status: "@" + name + " " + status,
                in_reply_to_status_id: tweet_id
            })

        } catch (e) {
            console.log(e)
        }
        req.flash("messages", {"success": "Replied Succesfully"});
        res.redirect('/timeline')
    }))

    app.get('/twitter/reply/:id', isLoggedIn, then(async (req, res) => {
        let twitterClient = getTwitterClient(req)
        let tweet_id = req.params.id
        let [tweet] = await twitterClient.promise.get('statuses/show/' + tweet_id)
        let body = {
            id: tweet.id_str,
            image: tweet.user.profile_image_url,
            text: tweet.text,
            name: tweet.user.name,
            username: tweet.user.screen_name,
            liked: tweet.favorited,
            network: {
                icon: 'twitter',
                name: 'twitter',
                class: 'btn-info'
            },
            createdAt: tweet.created_at,
            class: 'twitter'
        }
        res.render('reply.ejs', {
            post: body,
            message: req.flash('error')
        })
    }))

    app.post('/twitter/like/:id', isLoggedIn, then(async (req, res) => {
        try {
            let twitterClient = getTwitterClient(req)
            let id = req.params.id
            await twitterClient.promise.post('/favorites/create', {id})
            res.end()
        } catch (e) {
            console.log(e)
        }
    }))

    app.post('/twitter/unlike/:id', isLoggedIn, then(async (req, res) => {
        try {
            let twitterClient = getTwitterClient(req)
            let id = req.params.id
            await twitterClient.promise.post('favorites/destroy', {id})
            res.end()
        } catch (e) {
            console.log(e)
        }
    }))

    app.get('/compose', isLoggedIn, (req, res) => {
        res.render('compose.ejs', {
            message: req.flash('error')
        })
    })

    app.post('/tweet/compose', isLoggedIn, then(async (req, res) => {
        try {
            let twitterClient = getTwitterClient(req)
            let status = req.body.reply
            if (!status || status.length > 140) {
                return req.flash('error', 'Not a valid tweet')
            }
            await twitterClient.promise.post('statuses/update', {status})
        } catch (e) {
            console.log(e)
        }
        res.redirect('/timeline')
    }))

    app.get('/twitter/share/:id', isLoggedIn, then(async (req, res) => {
        try {
            let twitterClient = getTwitterClient(req);
            let tweet_id = req.params.id
            let [tweet] = await twitterClient.promise.get('statuses/show/' + tweet_id)

            let post = {
                id: tweet.id_str,
                image: tweet.user.profile_image_url,
                text: tweet.text,
                name: tweet.user.name,
                username: tweet.user.screen_name,
                liked: tweet.favorited,
                network: {
                    icon: 'twitter',
                    name: 'twitter',
                    class: 'btn-info'
                },
                createdAt: tweet.created_at,
                class: 'twitter'
            }
            res.render('share.ejs', {
                post: post,
                message: req.flash('error')
            })
        } catch (e) {
            console.log("Error:", e)
        }

    }))

    app.post('/twitter/share/:id', isLoggedIn, then(async (req, res) => {
        try {
            let twitterClient = getTwitterClient(req);
            let id = req.params.id
            let share = req.body.share
            await twitterClient.promise.post('statuses/retweet/' + id, {
                share
            })
        } catch (e) {
            console.log("Error:", e)
        }
        res.redirect('/timeline')
    }))

    async function getTwitterFeed(req) {
        let twitterClient = getTwitterClient(req)
        let [alltweets] = await twitterClient.promise.get('statuses/home_timeline');
        alltweets = alltweets.map(tweet => {
            return {
                id: tweet.id_str,
                image: tweet.user.profile_image_url,
                text: tweet.text,
                name: tweet.user.name,
                username: tweet.user.screen_name,
                liked: tweet.favorited,
                network: {
                    icon: 'twitter',
                    name: 'twitter',
                    class: 'btn-info'
                },
                class: 'twitter'
            }
        })
        return alltweets;
    }

    function getTwitterClient(req) {
        let twitterClient = new twitter({
            consumer_key: CONFIG.auth["twitter"].consumerKey,
            consumer_secret: CONFIG.auth["twitter"].consumerSecret,
            access_token_key: req.user.twitter.token,
            access_token_secret: CONFIG.auth["twitter"].tokenSecret
        })
        return twitterClient;
    }

    function getFbFeed(req) {
        /*
         fb.options({
         appId: CONFIG.auth["facebook"].consumerKey,
         appSecret: CONFIG.auth["facebook"].consumerSecret,
         redirectUri: CONFIG.auth["facebook"].callbackUrl,
         })
         fb.setAccessToken(req.user.facebook.token)
         let {feed} ='';
         try {
         let {feed} = await fb.api.promise('me/home')
         return feed;
         } catch (e) {
         feed = e.data
         console.log("Error:", e)
         }*/
        var OAuth = require('oauth2').OAuth2;
        var oauth = new OAuth(CONFIG.auth["facebook"].consumerKey, CONFIG.auth["facebook"].consumerSecret, "https://graph.facebook.com", null, "oauth2/token", null);
        var getData = function (userKey, done) {
            oauth.get('https://graph.facebook.com/v2.5/me?fields=name,picture,email&redirect=false',
                userKey,
                function (err, results, res) {
                    console.log(results)
                    results = JSON.parse(results);
                });
        };


    }
}
