import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  data: T;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T> | any>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T> | any> {
    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && 'data' in data && 'meta' in data) {
          return {
            success: true,
            ...data,
          };
        }
        return {
          success: true,
          data,
        };
      }),
    );
  }
}
