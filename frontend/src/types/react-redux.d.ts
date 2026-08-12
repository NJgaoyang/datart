/**
 * react-redux 9 + Redux Toolkit 2 类型增强
 *
 * 升级 react-redux 9 / redux 5 后，无类型标注的 `useDispatch()` 默认返回
 * `Dispatch<UnknownAction>`，无法分发 createAsyncThunk 产生的 thunk action，
 * 导致全项目大量 `dispatch(xxxThunk())` 调用报 TS2345。
 *
 * 这里通过声明合并向 `UseDispatch` 接口追加一个返回 `AppDispatch` 的调用签名。
 * 由于接口合并时"后声明优先"，无参 `useDispatch()` 会命中该签名，
 * 从而获得包含 thunk 中间件的完整 dispatch 类型，无需逐个修改调用点。
 *
 * 显式传泛型的 `useDispatch<AppDispatch>()` 仍会命中原始泛型签名，不受影响。
 */
import { Dispatch, UnknownAction } from 'redux';
import { AppDispatch } from 'redux/configureStore';

declare module 'react-redux' {
  interface UseDispatch<
    DispatchType extends Dispatch<UnknownAction> = Dispatch<UnknownAction>,
  > {
    (): AppDispatch;
  }
}
