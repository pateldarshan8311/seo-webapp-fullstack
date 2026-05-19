const express = require("express");

function createAuditRouter(auditService) {
  const router = express.Router();

  router.get("/audits", async (_request, response, next) => {
    try {
      const audits = await auditService.listAudits();
      response.json(audits);
    } catch (error) {
      next(error);
    }
  });

  router.post("/audits", async (request, response, next) => {
    try {
      const audit = await auditService.createAudit(request.body || {});
      response.status(202).json(audit);
    } catch (error) {
      next(error);
    }
  });

  router.get("/audits/:auditId", async (request, response, next) => {
    try {
      const audit = await auditService.getAudit(request.params.auditId);

      if (!audit) {
        response.status(404).json({ message: "Audit not found" });
        return;
      }

      response.json(audit);
    } catch (error) {
      next(error);
    }
  });

  router.get("/audits/:auditId/tasks", async (request, response, next) => {
    try {
      const result = await auditService.getTasks(request.params.auditId, request.query || {});

      if (!result) {
        response.status(404).json({ message: "Audit not found" });
        return;
      }

      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/audits/:auditId/tasks/:taskId", async (request, response, next) => {
    try {
      const result = await auditService.updateTask(request.params.auditId, request.params.taskId, request.body || {});

      if (!result) {
        response.status(404).json({ message: "Task not found" });
        return;
      }

      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/audits/:auditId/pages", async (request, response, next) => {
    try {
      const result = await auditService.updatePage(
        request.params.auditId,
        request.body?.url,
        request.body || {},
      );

      if (!result) {
        response.status(404).json({ message: "Page not found" });
        return;
      }

      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/audits/:auditId/tasks/:taskId/verify", async (request, response, next) => {
    try {
      const result = await auditService.verifyTask(request.params.auditId, request.params.taskId);

      if (!result) {
        response.status(404).json({ message: "Task not found" });
        return;
      }

      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/audits/:auditId/verify-open-tasks", async (request, response, next) => {
    try {
      const result = await auditService.verifyOpenTasks(request.params.auditId);

      if (!result) {
        response.status(404).json({ message: "Audit not found" });
        return;
      }

      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/audits/:auditId/pause", async (request, response, next) => {
    try {
      const audit = await auditService.pauseAudit(request.params.auditId);
      response.json(audit);
    } catch (error) {
      next(error);
    }
  });

  router.post("/audits/:auditId/resume", async (request, response, next) => {
    try {
      const audit = await auditService.resumeAudit(request.params.auditId);
      response.json(audit);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createAuditRouter;
