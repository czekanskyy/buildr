import type { BuilderComponentProps } from '@buildr/react';
import { message } from '../messages/index.ts';
import { FormEnhancer } from './enhancer.client.tsx';
import type { formProps } from './props.ts';

/**
 * The form itself is plain markup, so it submits without JavaScript. `action` comes from the
 * platform (a URL, or a server action a framework can call directly). The honeypot is a field a
 * person never sees and a bot fills in; the server rejects a submission that has it filled.
 */
export function FormView({
  props,
  root,
  children,
  node,
  env,
  platform,
}: BuilderComponentProps<typeof formProps>) {
  const action = platform?.formAction(env.layoutRef ?? '', node.id);
  return (
    <form
      {...root}
      method="post"
      {...(action !== undefined ? { action } : {})}
      {...(props.ariaLabel !== '' ? { 'aria-label': props.ariaLabel } : {})}
    >
      {children}
      <div className="bc-form__honeypot" aria-hidden="true">
        <label>
          {message(env, 'form.honeypot')}
          <input type="text" name="_hp" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <FormEnhancer
        action={typeof action === 'string' ? action : undefined}
        sending={message(env, 'form.sending')}
        success={props.successMessage !== '' ? props.successMessage : message(env, 'form.success')}
        failure={props.errorMessage !== '' ? props.errorMessage : message(env, 'form.error')}
      />
    </form>
  );
}
