import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { armIntro } from './app/motion/intro';

// Before the first render, so there is never a flash of the finished page followed by the intro.
armIntro();

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
