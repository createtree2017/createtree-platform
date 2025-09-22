import type { Request, Response, NextFunction } from "express";

/**
 * 숫자 파라미터 검증 미들웨어
 */
export function validateNumericParam(paramName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.params[paramName];
    
    if (!value) {
      return res.status(400).json({
        success: false,
        message: `${paramName} 파라미터가 필요합니다`
      });
    }

    const numericValue = parseInt(value, 10);
    if (isNaN(numericValue) || numericValue <= 0) {
      return res.status(400).json({
        success: false,
        message: `유효하지 않은 ${paramName} 값입니다`
      });
    }

    // 검증된 값을 req에 저장
    (req as any).validatedParams = {
      ...(req as any).validatedParams,
      [paramName]: numericValue
    };

    next();
  };
}

/**
 * 페이지네이션 쿼리 검증 미들웨어
 */
export function validatePagination(req: Request, res: Response, next: NextFunction) {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  // 페이지와 제한 값 검증
  if (page < 1) {
    return res.status(400).json({
      success: false,
      message: "페이지 번호는 1 이상이어야 합니다"
    });
  }

  if (limit < 1 || limit > 100) {
    return res.status(400).json({
      success: false,
      message: "제한 값은 1~100 사이여야 합니다"
    });
  }

  // 검증된 값을 req에 저장
  (req as any).pagination = {
    page,
    limit,
    offset: (page - 1) * limit
  };

  next();
}

/**
 * 병원 관리자 권한 및 병원 ID 검증 미들웨어
 */
export function validateHospitalAccess(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  
  if (!user) {
    return res.status(401).json({
      success: false,
      message: "인증이 필요합니다"
    });
  }

  if (user.memberType !== 'hospital_admin') {
    return res.status(403).json({
      success: false,
      message: "접근 권한 없음"
    });
  }

  if (!user.hospitalId) {
    return res.status(403).json({
      success: false,
      message: "접근 권한 없음"
    });
  }

  next();
}

/**
 * 관리자 권한 검증 미들웨어 (admin 또는 superadmin)
 */
export function validateAdminAccess(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  
  if (!user) {
    return res.status(401).json({
      success: false,
      message: "인증이 필요합니다"
    });
  }

  if (!['admin', 'superadmin'].includes(user.memberType)) {
    return res.status(403).json({
      success: false,
      message: "접근 권한 없음"
    });
  }

  next();
}

/**
 * 요청 본문 필수 필드 검증 미들웨어
 */
export function validateRequiredFields(fields: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const missingFields: string[] = [];

    for (const field of fields) {
      if (!req.body || req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `필수 필드가 누락되었습니다: ${missingFields.join(', ')}`
      });
    }

    next();
  };
}