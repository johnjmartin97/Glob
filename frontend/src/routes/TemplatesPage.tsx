import { Link } from 'react-router-dom';
import { useDeleteTemplate, useTemplates } from '../api/templates';
import { SwipeToDelete } from '../components/SwipeToDelete';

export function TemplatesPage() {
  const { data: templates, isLoading } = useTemplates();
  const deleteTemplate = useDeleteTemplate();

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Templates</h1>
        <Link
          to="/exercises"
          className="text-sm text-emerald-400"
        >
          Exercise library
        </Link>
      </div>

      <Link
        to="/templates/new"
        className="block w-full rounded-md bg-emerald-600 px-4 py-2 text-center font-medium text-white"
      >
        + New template
      </Link>

      {isLoading && <p className="text-sm text-slate-400">Loading templates…</p>}

      {!isLoading && templates?.length === 0 && (
        <p className="text-sm text-slate-400">
          No templates yet. Create one to get started.
        </p>
      )}

      <ul className="space-y-2">
        {templates?.map((template) => (
          <li key={template.id} className="overflow-hidden rounded-md border border-slate-800">
            <SwipeToDelete
              onDelete={() => deleteTemplate.mutate(template.id)}
            >
              <div className="flex items-center bg-slate-900 px-3 py-3">
                <Link to={`/templates/${template.id}/edit`} className="flex-1">
                  <p className="font-medium">{template.name}</p>
                  <p className="text-sm text-slate-400">
                    {template.exerciseCount} exercise{template.exerciseCount === 1 ? '' : 's'}
                  </p>
                </Link>
              </div>
            </SwipeToDelete>
          </li>
        ))}
      </ul>
    </div>
  );
}
