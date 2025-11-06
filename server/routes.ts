import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import path from "path";
import cookieParser from "cookie-parser";
import session from "express-session";

import musicEngineRouter from "./routes/music-engine-routes";
import collageRouter from "./routes/collage";
import bannerMigrationRouter from "./routes/banner-migration";
import milestoneRoutes from "./routes/milestone-routes";
import missionRoutes from "./routes/mission-routes";
import chatRoutes from "./routes/chat-routes";
import conceptsRouter from "./routes/concepts";
import serviceCatalogRouter from "./routes/service-catalog";
import galleryRouter from "./routes/gallery";
import userSettingsRouter from "./routes/user-settings";
import profileRouter from "./routes/profile";
import exportsRouter from "./routes/exports";
import testRoutesRouter from "./routes/test-routes";
import miscRoutesRouter from "./routes/misc-routes";
import googleOAuthRouter from "./routes/google-oauth";
import imageRouter from "./routes/image";
import snapshotRouter from "./routes/snapshot";
import authRoutes from "./routes/auth";
import { placeholderRouter } from './routes/placeholder';

import { requireAuth } from "./middleware/auth";
import { errorHandler } from "./middleware/error-handler";
import { requestLogger, responseFormatter } from "./middleware/response";
import { initPassport } from "./services/auth";

import { registerAdminRoutes } from './routes/admin-routes';
import { registerHospitalRoutes } from './routes/hospital-routes';
import { registerPublicRoutes } from './routes/public-routes';

declare module 'express-session' {
  interface SessionData {
    tempImage?: {
      id: number;
      title: string;
      style: string;
      originalUrl: string;
      transformedUrl: string;
      createdAt: string;
      isTemporary: boolean;
      localFilePath?: string;
      dbImageId?: number;
    };
    userId?: number;
    firebaseUid?: string;
    userEmail?: string;
    userRole?: string;
    isAdmin?: boolean;
    isHospitalAdmin?: boolean;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  registerAdminRoutes(app);
  registerHospitalRoutes(app);
  registerPublicRoutes(app);

  const { default: uploadRouter } = await import('./routes/upload');
  app.use('/api/upload', uploadRouter);

  app.use('/api', milestoneRoutes);
  app.use('/api', missionRoutes);

  const serveFile = (basePath: string) => (req: any, res: any, next: any) => {
    const filePath = path.join(process.cwd(), basePath, req.path);
    res.sendFile(filePath, (err: any) => {
      if (err) next();
    });
  };

  app.use('/uploads', serveFile('uploads'));
  app.use('/uploads/temp', serveFile('uploads/temp'));

  app.use(cookieParser());

  app.use(session({
    secret: process.env.SESSION_SECRET || 'create-tree-mobile-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000
    },
    name: 'createtree.sid'
  }));

  const passport = initPassport();
  app.use(passport.initialize());
  app.use(passport.session());

  app.use("/api/auth", authRoutes);
  app.use("/api/placeholder", placeholderRouter);
  app.use("/api", serviceCatalogRouter);
  app.use("/api/google-oauth", googleOAuthRouter);

  app.use('/api', galleryRouter);
  app.use('/', exportsRouter);
  app.use('/', conceptsRouter);
  app.use('/api', userSettingsRouter);
  app.use('/', profileRouter);
  // 테스트 라우터는 프로덕션에서 완전히 비활성화
  if (process.env.NODE_ENV !== 'production') {
    app.use('/api/test', testRoutesRouter);
  }
  app.use('/', miscRoutesRouter);
  app.use('/api', imageRouter);

  app.use('/api/music-engine', musicEngineRouter);
  app.use('/api/music', musicEngineRouter);
  app.use('/api/chat', chatRoutes);
  app.use('/api/snapshot', snapshotRouter);
  app.use('/api/admin/banner-migration', bannerMigrationRouter);
  app.use('/api/collage', (req, res, next) => {
    requireAuth(req, res, (err?: any) => {
      if (err) return next(err);
      collageRouter(req, res, next);
    });
  });

  app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));
  app.use('/static', express.static(path.join(process.cwd(), 'static')));

  app.use(requestLogger);
  app.use(responseFormatter);
  
  // Sentry 에러 핸들러 (모든 라우트 후, 커스텀 에러 핸들러 전에 추가)
  const Sentry = await import("@sentry/node");
  Sentry.setupExpressErrorHandler(app);
  
  app.use(errorHandler);

  const httpServer = createServer(app);

  return httpServer;
}
