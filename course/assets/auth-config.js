/* ===========================================================================
   Who may open the course, and the project that sends the sign-in email.

   This is the only file you edit to let more people in. Everything else in
   the sign-in flow reads its settings from here.
   =========================================================================== */

window.GT_AUTH = {

  /* -------------------------------------------------------------------------
     Firebase project that delivers the sign-in email.

     Copy these four values from the Firebase console:
       Project settings  ->  General  ->  Your apps  ->  SDK setup, "Config"

     These values are meant to be public — every Firebase web app ships them
     in its page source. What protects the project is the authorised-domain
     list, not secrecy, so add your site's domain there and nowhere else.

     Leave them blank and the course runs in open mode: the gate still asks
     for an email, but no link is sent and nobody is turned away. That keeps
     the site usable while the project is still being set up.
     ------------------------------------------------------------------------- */
  firebase: {
    apiKey:     "",
    authDomain: "",
    projectId:  "",
    appId:      ""
  },

  /* -------------------------------------------------------------------------
     People who open the course straight away, without waiting for a link.

     The addresses are stored as SHA-256 hashes rather than plain text. This
     repository is public, so a plain address here would be readable by anyone
     — handed to spam scrapers, and usable by any of them to walk in, since
     entering a listed address is all it takes to skip verification.

     TO ADD SOMEONE
       1. Open  tools/hash-email.html  in a browser
       2. Type their email address
       3. Copy the generated line and paste it into the list below
       4. Commit and push

     Keep the label non-identifying — a first name is fine, a full address
     defeats the point of hashing it in the first place.
     ------------------------------------------------------------------------- */
  skipVerification: [
    { label: "Admin 1", hash: "8e10535771839823a2fdac32c2148b3bfd8bde730e3eca635f222e754a298cc4" },
    { label: "Admin 2", hash: "3b318cd9507ecbf7dedb4a150c3a385facfcbdcc062495ca5dc4829e78b8959d" }
  ],

  /* -------------------------------------------------------------------------
     Where the emailed link returns to. Blank means "back to this same page",
     which is what you want unless the course moves to its own domain.
     ------------------------------------------------------------------------- */
  returnUrl: ""
};
